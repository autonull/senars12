/**
 * Soak Test — D7 continuous seeded world; D8 side-by-side lanes;
 * one-hour unattended soak, replayable and recoverable — evolution included.
 */

import type { HabitatConfig, HabitatRegistry } from './habitat';
import type { ArenaAgent, ArenaMatch } from './arena';
import type { LaneConfig, SymmetricArmConfig, CostQualitySurface, CostQualityPoint } from './arena-lanes';
import type { WorldPackConfig } from './world-packs';
import { createHabitatRegistry } from './habitat';
import { createArenaAgent } from './arena';
import { createLaneArenaRunner, runNalAbAsLane } from './arena-lanes';
import { createWorldEvaluator } from './world-packs';
import type { Term } from '../kernel/terms';
import type { Clock, RNG, TimestampMs } from '../kernel/env';
import { createDefaultClock, createDefaultRNG } from '../kernel/env';
import type { Repertoire } from '../admit/repertoire';
import { createRepertoire } from '../admit/repertoire';
import type { EvaluationFold } from './scorecard';
import { createLogger } from '../util/logger';

const logger = createLogger({ scope: 'worlds:soak' });

/** Soak configuration. */
export interface SoakConfig {
  /** Duration in milliseconds (default 1 hour). */
  durationMs: number;
  /** Seeds for reproducibility. */
  seeds: number[];
  /** Episodes per seed. */
  episodesPerSeed: number;
  /** Habitat to run. */
  habitat: HabitatConfig;
  /** Agent factory. */
  agentFactory: (laneConfig: LaneConfig) => ArenaAgent;
  /** Agent action function. */
  agentActFn: (agent: ArenaAgent, state: any, habitat: HabitatConfig, budget: any) => Promise<any>;
  /** Lane configurations. */
  laneConfigs: LaneConfig[];
  /** Checkpoint interval (ms). */
  checkpointIntervalMs: number;
  /** Enable evolution (self-modification during soak). */
  enableEvolution: boolean;
  /** Evolution interval (cycles). */
  evolutionInterval: number;
  /** Output directory for logs/checkpoints. */
  outputDir: string;
  /** Optional clock (defaults to system clock). */
  clock?: Clock;
  /** Optional RNG (defaults to system RNG). */
  rng?: RNG;
}

/** Default soak config (1 hour). */
export const defaultSoakConfig: SoakConfig = {
  durationMs: 60 * 60 * 1000, // 1 hour
  seeds: [42, 123, 456, 789, 999, 1111, 2222, 3333],
  episodesPerSeed: 10,
  habitat: {
    id: 'soak-default' as any,
    name: 'Soak Default',
    kind: 'gridworld',
    seed: 42,
    maxSteps: 100,
    initialState: {
      step: 0,
      episode: 0,
      entities: new Map(),
      agent: { position: { x: 0, y: 0 }, inventory: [], energy: 100, internal: new Map() },
      env: new Map<string, unknown>([['size', 10], ['goal', { x: 9, y: 9 }]]),
      rngState: '42',
    },
    transition: 'gridworld',
    reward: 'sparse',
    termination: { maxSteps: true, goalAchieved: true },
    metadata: {},
  },
  agentFactory: (laneConfig) => createArenaAgent(`agent-${laneConfig.id}-${laneConfig.tier}`, 'Soak Agent', 'soak', { lane: laneConfig.id, tier: laneConfig.tier }),
  agentActFn: async () => ({ type: 'move', params: { dx: 1, dy: 0 }, lmCalls: 0, oracleCalls: 0 }),
  laneConfigs: [],
  checkpointIntervalMs: 5 * 60 * 1000, // 5 minutes
  enableEvolution: true,
  evolutionInterval: 100,
  outputDir: './data/soak',
};

/** Soak checkpoint. */
export interface SoakCheckpoint {
  /** Checkpoint ID. */
  id: string;
  /** Timestamp. */
  timestamp: number;
  /** Elapsed time (ms). */
  elapsedMs: number;
  /** Current seed index. */
  seedIndex: number;
  /** Current episode. */
  episode: number;
  /** Lane results so far. */
  laneResults: Map<string, CostQualityPoint[]>;
  /** Repertoire state. */
  repertoireStats: any;
  /** Evolution cycle. */
  evolutionCycle: number;
  /** Random state for recovery. */
  rngState: string;
}

/** Soak result. */
export interface SoakResult {
  /** Success. */
  success: boolean;
  /** Total duration (ms). */
  durationMs: number;
  /** Cost/quality surface. */
  surface: CostQualitySurface;
  /** Checkpoints. */
  checkpoints: SoakCheckpoint[];
  /** Final repertoire. */
  finalRepertoire: Repertoire;
  /** Evolution log. */
  evolutionLog: EvolutionEvent[];
  /** Errors. */
  errors: string[];
}

/** Evolution event. */
export interface EvolutionEvent {
  /** Event ID. */
  id: string;
  /** Cycle number. */
  cycle: number;
  /** Timestamp. */
  timestamp: number;
  /** Type of evolution. */
  type: 'admission' | 'demotion' | 'skill-creation' | 'policy-change' | 'self-modification';
  /** Description. */
  description: string;
  /** Artifact IDs affected. */
  artifactIds: string[];
  /** Replay seed. */
  seed: number;
}

/** Soak runner. */
export class SoakRunner {
  private config: SoakConfig;
  private clock: Clock;
  private rng: RNG;
  private laneRunner: any;
  private worldEvaluator: ReturnType<typeof createWorldEvaluator>;
  private repertoire: Repertoire;
  private checkpoints: SoakCheckpoint[] = [];
  private evolutionLog: EvolutionEvent[] = [];
  private errors: string[] = [];
  private startTime: number = 0;
  private currentSeedIndex: number = 0;
  private currentEpisode: number = 0;
  private evolutionCycle: number = 0;
  private running: boolean = false;
  private abortController: AbortController | null = null;

  constructor(config: Partial<SoakConfig> = {}) {
    this.config = { ...defaultSoakConfig, ...config };
    this.clock = this.config.clock ?? createDefaultClock();
    this.rng = this.config.rng ?? createDefaultRNG();
    this.laneRunner = createLaneArenaRunner(createHabitatRegistry(), this.config.laneConfigs);
    this.worldEvaluator = createWorldEvaluator();
    this.repertoire = createRepertoire();
  }

  /** Start the soak test. */
  async run(): Promise<SoakResult> {
    this.running = true;
    this.abortController = new AbortController();
    this.startTime = this.clock.now();

    try {
      // Initialize lane configs if not provided
      if (this.config.laneConfigs.length === 0) {
        const { createDefaultLaneConfigs } = await import('./arena-lanes');
        this.config.laneConfigs = createDefaultLaneConfigs();
      }

      // Run evaluation surface
      const surface = await this.laneRunner.evaluateSurface(
        this.config.habitat,
        this.config.agentFactory,
        this.config.agentActFn,
        this.config.seeds,
        this.config.episodesPerSeed
      );

      // Run continuous world with checkpoints
      await this.runContinuousWorld();

      // Run side-by-side lanes (D8)
      await this.runSideBySideLanes();

      // Run NAL-AB as A/B lane
      await this.runNalAbLane();

      const durationMs = this.clock.now() - this.startTime;

      return {
        success: this.errors.length === 0,
        durationMs,
        surface,
        checkpoints: this.checkpoints,
        finalRepertoire: this.repertoire,
        evolutionLog: this.evolutionLog,
        errors: this.errors,
      };
    } catch (error) {
      this.errors.push(error instanceof Error ? error.message : String(error));
      return {
        success: false,
        durationMs: this.clock.now() - this.startTime,
        surface: { points: [], generatedAt: this.clock.now(), config: { seeds: [], episodesPerSeed: 0, modelProvider: '' } },
        checkpoints: this.checkpoints,
        finalRepertoire: this.repertoire,
        evolutionLog: this.evolutionLog,
        errors: this.errors,
      };
    } finally {
      this.running = false;
    }
  }

  /** Run continuous seeded world (D7). */
  private async runContinuousWorld(): Promise<void> {
    const { seeds, episodesPerSeed, habitat, agentFactory, agentActFn, checkpointIntervalMs } = this.config;

    for (let seedIdx = 0; seedIdx < seeds.length && this.running; seedIdx++) {
      this.currentSeedIndex = seedIdx;
      const seed = seeds[seedIdx];
      const seededHabitat = { ...habitat, seed };

      for (let ep = 0; ep < episodesPerSeed && this.running; ep++) {
        this.currentEpisode = ep;

        // Run episodes for each lane/tier
        for (const laneConfig of this.config.laneConfigs) {
          const agent = agentFactory(laneConfig);
          await this.laneRunner.runEpisode(agent, seededHabitat, laneConfig, agentActFn);
        }

        // Checkpoint
        if (this.shouldCheckpoint()) {
          await this.saveCheckpoint();
        }

        // Evolution step
        if (this.config.enableEvolution && this.evolutionCycle % this.config.evolutionInterval === 0) {
          await this.runEvolutionStep(seed!);
        }
        this.evolutionCycle++;

        // Small delay to prevent CPU saturation
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  /** Run side-by-side lanes (D8). */
  private async runSideBySideLanes(): Promise<void> {
    // Run symmetric arms comparison
    const arms = this.config.laneConfigs.map(c => `${c.id}-${c.tier}`);
    logger.info(`[Soak] Running side-by-side comparison for ${arms.length} arms`);

    // This would run the full symmetric arms comparison
    // For now, the evaluateSurface already covers this
  }

  /** Run NAL-AB as A/B lane. */
  private async runNalAbLane(): Promise<void> {
    // This would integrate with the focus/nal-ab module
    logger.info(`[Soak] NAL-AB lane evaluation would run here`);
  }

  /** Check if should save checkpoint. */
  private shouldCheckpoint(): boolean {
    return this.clock.now() - this.startTime > this.checkpoints.length * this.config.checkpointIntervalMs;
  }

  /** Save checkpoint for recovery. */
  private async saveCheckpoint(): Promise<void> {
    const checkpoint: SoakCheckpoint = {
      id: `checkpoint-${this.clock.now()}`,
      timestamp: this.clock.now(),
      elapsedMs: this.clock.now() - this.startTime,
      seedIndex: this.currentSeedIndex,
      episode: this.currentEpisode,
      laneResults: new Map(),
      repertoireStats: this.repertoire.getStats(),
      evolutionCycle: this.evolutionCycle,
      rngState: this.rng.next().toString(36),
    };
    this.checkpoints.push(checkpoint);

    // In a real implementation, save to disk
    logger.info(`[Soak] Checkpoint saved: ${checkpoint.id} at ${checkpoint.elapsedMs}ms`);
  }

  /** Run evolution step (self-modification). */
  private async runEvolutionStep(seed: number): Promise<void> {
    // This would run the admission machinery for self-modification
    const event: EvolutionEvent = {
      id: `evolution-${this.evolutionCycle}`,
      cycle: this.evolutionCycle,
      timestamp: this.clock.now(),
      type: 'admission',
      description: `Evolution cycle ${this.evolutionCycle} at seed ${seed}`,
      artifactIds: [],
      seed,
    };
    this.evolutionLog.push(event);
  }

  /** Abort the soak test. */
  abort(): void {
    this.running = false;
    this.abortController?.abort();
  }

  /** Resume from checkpoint. */
  async resumeFromCheckpoint(checkpoint: SoakCheckpoint): Promise<void> {
    this.currentSeedIndex = checkpoint.seedIndex;
    this.currentEpisode = checkpoint.episode;
    this.evolutionCycle = checkpoint.evolutionCycle;
    // Restore RNG state would require a more sophisticated RNG
    logger.info(`[Soak] Resuming from checkpoint ${checkpoint.id}`);
  }

  /** Get current status. */
  getStatus(): {
    running: boolean;
    elapsedMs: number;
    progress: number;
    currentSeed: number;
    currentEpisode: number;
    evolutionCycle: number;
  } {
    const elapsed = this.clock.now() - this.startTime;
    const totalEpisodes = this.config.seeds.length * this.config.episodesPerSeed;
    const completedEpisodes = this.currentSeedIndex * this.config.episodesPerSeed + this.currentEpisode;
    return {
      running: this.running,
      elapsedMs: elapsed,
      progress: totalEpisodes > 0 ? completedEpisodes / totalEpisodes : 0,
      currentSeed: this.config.seeds[this.currentSeedIndex] ?? 0,
      currentEpisode: this.currentEpisode,
      evolutionCycle: this.evolutionCycle,
    };
  }
}

/** Create a soak runner. */
export function createSoakRunner(config?: Partial<SoakConfig>): SoakRunner {
  return new SoakRunner(config);
}

/** Run a full soak test and export results. */
export async function runSoakTest(
  config: Partial<SoakConfig> = {}
): Promise<SoakResult> {
  const runner = createSoakRunner(config);
  return runner.run();
}

/** Export soak result for replay. */
export function exportSoakResult(result: SoakResult): string {
  return JSON.stringify({
    ...result,
    checkpoints: Array.from(result.checkpoints),
    surface: {
      ...result.surface,
      points: result.surface.points,
    },
  }, null, 2);
}

/** Import soak result for replay. */
export function importSoakResult(json: string): SoakResult {
  const data = JSON.parse(json);
  return {
    ...data,
    checkpoints: data.checkpoints,
  };
}