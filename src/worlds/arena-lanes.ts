/**
 * Arena Lanes — A–D × fast/balanced/deliberate symmetric arms.
 *
 * Four lanes with identical seeds/models/tools/schemas; only the
 * deliberation budget differs. Publishes cost/quality surface.
 */

import type { HabitatConfig, HabitatRegistry } from './habitat';
import type { ArenaAgent, ArenaMatch, ArenaTournament, EpisodeResult } from './arena';
import type { ReasoningBudget } from '../lm/system-one/types';
import { createHabitatRegistry } from './habitat';
import { createArenaAgent } from './arena';

/** Lane identifier. */
export type ArenaLaneId = 'A' | 'B' | 'C' | 'D';

/** Deliberation tier. */
export type DeliberationTier = 'fast' | 'balanced' | 'deliberate';

/** Lane configuration. */
export interface LaneConfig {
  /** Lane ID (A–D). */
  id: ArenaLaneId;
  /** Deliberation tier. */
  tier: DeliberationTier;
  /** Reasoning budget for this lane. */
  budget: ReasoningBudget;
  /** Model tier for LM calls. */
  modelTier: 'fast' | 'balanced' | 'quality';
  /** Max oracle calls per step. */
  maxOracleCalls: number;
  /** Max steps per episode. */
  maxSteps: number;
  /** Temperature for generation. */
  temperature: number;
}

/** Symmetric arm configuration — all arms share the same seed/tools/schema. */
export interface SymmetricArmConfig {
  /** Arm identifier. */
  id: string;
  /** Lane this arm belongs to. */
  lane: ArenaLaneId;
  /** Shared seed across all arms. */
  seed: number;
  /** Shared model configuration. */
  modelConfig: {
    tier: 'fast' | 'balanced' | 'quality';
    provider: string;
    model: string;
  };
  /** Shared tool configuration. */
  toolConfig: Record<string, unknown>;
  /** Shared schema version. */
  schemaVersion: string;
}

/** Cost/quality data point for the surface. */
export interface CostQualityPoint {
  /** Lane ID. */
  lane: ArenaLaneId;
  /** Deliberation tier. */
  tier: DeliberationTier;
  /** Mean reward. */
  meanReward: number;
  /** Std deviation of reward. */
  stdReward: number;
  /** Mean steps per episode. */
  meanSteps: number;
  /** Total LM calls. */
  totalLmCalls: number;
  /** Total oracle calls. */
  totalOracleCalls: number;
  /** Wall-clock time (ms). */
  wallTimeMs: number;
  /** Brier score (if judged). */
  brierScore?: number;
  /** ECE (if judged). */
  ece?: number;
}

/** Cost/quality surface — published results. */
export interface CostQualitySurface {
  /** Points per lane/tier combination. */
  points: CostQualityPoint[];
  /** Generated at. */
  generatedAt: number;
  /** Configuration used. */
  config: {
    seeds: number[];
    episodesPerSeed: number;
    modelProvider: string;
  };
}

/** Default lane configurations for A–D × fast/balanced/deliberate. */
export function createDefaultLaneConfigs(): LaneConfig[] {
  return [
    // Lane A: fast
    { id: 'A', tier: 'fast', budget: { maxTokens: 512, maxLatencyMs: 100, maxCost: 0.001, maxCalls: 2 },
      modelTier: 'fast', maxOracleCalls: 2, maxSteps: 50, temperature: 0.3 },
    { id: 'A', tier: 'balanced', budget: { maxTokens: 1024, maxLatencyMs: 500, maxCost: 0.005, maxCalls: 4 },
      modelTier: 'balanced', maxOracleCalls: 4, maxSteps: 100, temperature: 0.5 },
    { id: 'A', tier: 'deliberate', budget: { maxTokens: 2048, maxLatencyMs: 2000, maxCost: 0.02, maxCalls: 8 },
      modelTier: 'quality', maxOracleCalls: 8, maxSteps: 200, temperature: 0.7 },

    // Lane B: fast
    { id: 'B', tier: 'fast', budget: { maxTokens: 512, maxLatencyMs: 100, maxCost: 0.001, maxCalls: 2 },
      modelTier: 'fast', maxOracleCalls: 2, maxSteps: 50, temperature: 0.3 },
    { id: 'B', tier: 'balanced', budget: { maxTokens: 1024, maxLatencyMs: 500, maxCost: 0.005, maxCalls: 4 },
      modelTier: 'balanced', maxOracleCalls: 4, maxSteps: 100, temperature: 0.5 },
    { id: 'B', tier: 'deliberate', budget: { maxTokens: 2048, maxLatencyMs: 2000, maxCost: 0.02, maxCalls: 8 },
      modelTier: 'quality', maxOracleCalls: 8, maxSteps: 200, temperature: 0.7 },

    // Lane C: fast
    { id: 'C', tier: 'fast', budget: { maxTokens: 512, maxLatencyMs: 100, maxCost: 0.001, maxCalls: 2 },
      modelTier: 'fast', maxOracleCalls: 2, maxSteps: 50, temperature: 0.3 },
    { id: 'C', tier: 'balanced', budget: { maxTokens: 1024, maxLatencyMs: 500, maxCost: 0.005, maxCalls: 4 },
      modelTier: 'balanced', maxOracleCalls: 4, maxSteps: 100, temperature: 0.5 },
    { id: 'C', tier: 'deliberate', budget: { maxTokens: 2048, maxLatencyMs: 2000, maxCost: 0.02, maxCalls: 8 },
      modelTier: 'quality', maxOracleCalls: 8, maxSteps: 200, temperature: 0.7 },

    // Lane D: fast
    { id: 'D', tier: 'fast', budget: { maxTokens: 512, maxLatencyMs: 100, maxCost: 0.001, maxCalls: 2 },
      modelTier: 'fast', maxOracleCalls: 2, maxSteps: 50, temperature: 0.3 },
    { id: 'D', tier: 'balanced', budget: { maxTokens: 1024, maxLatencyMs: 500, maxCost: 0.005, maxCalls: 4 },
      modelTier: 'balanced', maxOracleCalls: 4, maxSteps: 100, temperature: 0.5 },
    { id: 'D', tier: 'deliberate', budget: { maxTokens: 2048, maxLatencyMs: 2000, maxCost: 0.02, maxCalls: 8 },
      modelTier: 'quality', maxOracleCalls: 8, maxSteps: 200, temperature: 0.7 },
  ];
}

/** Create symmetric arms for a lane (all arms identical except lane assignment). */
export function createSymmetricArms(
  lane: ArenaLaneId,
  tier: DeliberationTier,
  seed: number,
  modelProvider: string,
  modelName: string,
  toolConfig: Record<string, unknown> = {},
  schemaVersion = '1.0.0'
): SymmetricArmConfig[] {
  const armCount = 4; // A, B, C, D each have symmetric arms
  return Array.from({ length: armCount }, (_, i) => ({
    id: `${lane}-${tier}-arm-${i + 1}`,
    lane,
    seed,
    modelConfig: { tier: tier === 'fast' ? 'fast' : tier === 'balanced' ? 'balanced' : 'quality', provider: modelProvider, model: modelName },
    toolConfig: { ...toolConfig },
    schemaVersion,
  }));
}

/** Arena runner with lane support. */
export class LaneArenaRunner {
  private registry: HabitatRegistry;
  private laneConfigs: LaneConfig[];
  private results: Map<string, CostQualityPoint[]> = new Map();

  constructor(registry: HabitatRegistry, laneConfigs: LaneConfig[] = createDefaultLaneConfigs()) {
    this.registry = registry;
    this.laneConfigs = laneConfigs;
  }

  /** Run a single episode for an agent in a specific lane/tier. */
  async runEpisode(
    agent: ArenaAgent,
    habitat: HabitatConfig,
    laneConfig: LaneConfig,
    agentActFn: (agent: ArenaAgent, state: any, habitat: HabitatConfig, budget: ReasoningBudget) => Promise<any>
  ): Promise<EpisodeResult> {
    const startTime = Date.now();
    let state = {
      step: 0,
      episode: 0,
      entities: new Map(habitat.initialState.entities),
      agent: { ...habitat.initialState.agent },
      env: new Map(habitat.initialState.env),
      rngState: habitat.seed.toString(),
    };

    let totalReward = 0;
    const stepRewards: number[] = [];
    let terminated = false;
    let steps = 0;
    let totalLmCalls = 0;
    let totalOracleCalls = 0;

    while (!terminated && steps < laneConfig.maxSteps) {
      const action = await agentActFn(agent, state, habitat, laneConfig.budget);
      totalLmCalls += action.lmCalls ?? 0;
      totalOracleCalls += action.oracleCalls ?? 0;

      // Apply action (simplified)
      const transition = this.registry.transitions.get(habitat.transition);
      const rewardFn = this.registry.rewards.get(habitat.reward);

      if (transition && rewardFn) {
        const nextState = transition(state, action, habitat);
        nextState.step = state.step + 1;
        const reward = rewardFn(state, action, nextState, habitat);
        totalReward += reward;
        stepRewards.push(reward);
        state = nextState;
        steps++;

        // Check termination
        if (habitat.termination.maxSteps && nextState.step >= habitat.maxSteps) {
          terminated = true;
        }
      } else {
        terminated = true;
      }
    }

    const wallTimeMs = Date.now() - startTime;

    return {
      episode: state.episode,
      steps,
      totalReward,
      termination: terminated ? 'maxSteps' : 'completed',
      stepRewards,
      lane: `${laneConfig.id}-${laneConfig.tier}` as any,
      metadata: {
        wallTimeMs,
        totalLmCalls,
        totalOracleCalls,
        tier: laneConfig.tier,
        modelTier: laneConfig.modelTier,
      },
    };
  }

  /** Run full lane evaluation across seeds. */
  async evaluateLane(
    lane: ArenaLaneId,
    tier: DeliberationTier,
    habitat: HabitatConfig,
    agentFactory: (laneConfig: LaneConfig) => ArenaAgent,
    agentActFn: (agent: ArenaAgent, state: any, habitat: HabitatConfig, budget: ReasoningBudget) => Promise<any>,
    seeds: number[] = [42, 123, 456, 789],
    episodesPerSeed = 5
  ): Promise<CostQualityPoint> {
    const laneConfig = this.laneConfigs.find(c => c.id === lane && c.tier === tier);
    if (!laneConfig) throw new Error(`Lane config not found: ${lane}-${tier}`);

    const allEpisodes: EpisodeResult[] = [];
    let totalLmCalls = 0;
    let totalOracleCalls = 0;
    let totalWallTime = 0;

    for (const seed of seeds) {
      const seededHabitat = { ...habitat, seed };
      for (let ep = 0; ep < episodesPerSeed; ep++) {
        const agent = agentFactory(laneConfig);
        const episode = await this.runEpisode(agent, seededHabitat, laneConfig, agentActFn);
        allEpisodes.push(episode);
        totalLmCalls += episode.metadata?.totalLmCalls ?? 0;
        totalOracleCalls += episode.metadata?.totalOracleCalls ?? 0;
        totalWallTime += episode.metadata?.wallTimeMs ?? 0;
      }
    }

    const rewards = allEpisodes.map(e => e.totalReward);
    const steps = allEpisodes.map(e => e.steps);
    const meanReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
    const stdReward = Math.sqrt(rewards.reduce((a, b) => a + (b - meanReward) ** 2, 0) / rewards.length);
    const meanSteps = steps.reduce((a, b) => a + b, 0) / steps.length;

    return {
      lane,
      tier,
      meanReward,
      stdReward,
      meanSteps,
      totalLmCalls,
      totalOracleCalls,
      wallTimeMs: totalWallTime,
    };
  }

  /** Run full cost/quality surface evaluation. */
  async evaluateSurface(
    habitat: HabitatConfig,
    agentFactory: (laneConfig: LaneConfig) => ArenaAgent,
    agentActFn: (agent: ArenaAgent, state: any, habitat: HabitatConfig, budget: ReasoningBudget) => Promise<any>,
    seeds: number[] = [42, 123, 456, 789],
    episodesPerSeed = 5,
    modelProvider = 'builtin',
    modelName = 'mock'
  ): Promise<CostQualitySurface> {
    const points: CostQualityPoint[] = [];

    for (const laneConfig of this.laneConfigs) {
      const point = await this.evaluateLane(
        laneConfig.id,
        laneConfig.tier,
        habitat,
        agentFactory,
        agentActFn,
        seeds,
        episodesPerSeed
      );
      points.push(point);
    }

    return {
      points,
      generatedAt: Date.now(),
      config: { seeds, episodesPerSeed, modelProvider },
    };
  }

  /** Publish cost/quality surface (export as JSON). */
  publishSurface(surface: CostQualitySurface): string {
    return JSON.stringify(surface, null, 2);
  }
}

/** Create a lane arena runner. */
export function createLaneArenaRunner(
  registry?: HabitatRegistry,
  laneConfigs?: LaneConfig[]
): LaneArenaRunner {
  return new LaneArenaRunner(registry ?? createHabitatRegistry(), laneConfigs);
}

/** NAL-AB integration as arena A/B lane. */
export interface NalAbLaneConfig {
  /** Habitat for the game. */
  habitat: HabitatConfig;
  /** Number of ticks per episode. */
  ticks: number;
  /** Seeds for evaluation. */
  seeds: number[];
}

/** Run NAL-AB as an arena lane comparison. */
export async function runNalAbAsLane(
  makeGame: () => any,
  makeReflex: () => any,
  config: NalAbLaneConfig
): Promise<CostQualityPoint[]> {
  const { runNalAB } = await import('../focus/nal-ab');
  const points: CostQualityPoint[] = [];

  for (const seed of config.seeds) {
    const game = makeGame();
    const reflex = makeReflex();
    const result = await runNalAB(() => game, () => reflex, config.ticks);

    points.push({
      lane: 'A',
      tier: 'balanced',
      meanReward: result.delta,
      stdReward: 0,
      meanSteps: config.ticks,
      totalLmCalls: 0,
      totalOracleCalls: 0,
      wallTimeMs: 0,
      metadata: {
        ruleReturn: result.ruleReturn,
        noRuleReturn: result.noRuleReturn,
        vetoesWithRules: result.vetoesWithRules,
        vetoesWithoutRules: result.vetoesWithoutRules,
      } as any,
    });
  }

  return points;
}