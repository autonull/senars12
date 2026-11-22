/**
 * Internal Simulation / Imagination Oracle — wraps ScenarioGenerator,
 * HiddenModelOracle, and CognitiveTreadmill through the oracle seam.
 */

import { createHash } from 'crypto';
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from './oracle.js';
import type { BudgetSlice, BudgetResource } from '../budget/budget.js';
import { OraclePinStore } from './pins.js';
import { createScenarioGenTools, type ScenarioGenDeps, type ScenarioResult, type ScenarioSpec } from '../tools/adapters/scenario-gen.js';
import type { ILMService } from '../lm/interfaces.js';
import type { EpisodicMemory } from '../memory/EpisodicMemory.js';

/** Input for generating scenarios. */
export interface ImaginationGenerateInput extends OracleInput {
  operation: 'imagination.generate';
  args: [seed: string, profile?: string, count?: number];
}

/** Input for running scenarios. */
export interface ImaginationRunInput extends OracleInput {
  operation: 'imagination.run';
  args: [spec: ScenarioSpec];
}

/** Input for getting scenario profiles. */
export interface ImaginationProfilesInput extends OracleInput {
  operation: 'imagination.profiles';
  args: [];
}

/** Imagination Oracle configuration. */
export interface ImaginationOracleConfig extends OracleConfig {
  operation: 'imagination.generate' | 'imagination.run' | 'imagination.profiles';
  nar?: any;
  episodicMemory?: EpisodicMemory;
  lmService?: ILMService;
  rlfpLearner?: { reward: (reward: number, correlationId: string) => void };
}

/** Imagination Oracle implementation. */
export class ImaginationOracle implements Oracle<
  ImaginationGenerateInput | ImaginationRunInput | ImaginationProfilesInput,
  { success: boolean; seed: string; profile: string; scenarios_generated: number; scenarios_executed: number; specs: ScenarioSpec[]; results: ScenarioResult[]; summary: { passed: number; failed: number; avg_reward: number } } | ScenarioResult | string[]
> {
  public readonly operation: ImaginationOracleConfig['operation'];
  public readonly provider: string;
  public readonly version?: string;
  public readonly budgetResource?: BudgetResource;

  private nar?: any;
  private episodicMemory?: EpisodicMemory;
  private lmService?: ILMService;
  private rlfpLearner?: ImaginationOracleConfig['rlfpLearner'];
  private scenarioTools: ReturnType<typeof createScenarioGenTools> | null = null;

  private pinStore: OraclePinStore | null = null;
  private isReplay = false;
  private defaultBudgetSlice?: BudgetSlice;

  private stats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    pinnedCalls: 0,
    totalDurationMs: 0,
  };

  constructor(config: ImaginationOracleConfig) {
    this.operation = config.operation;
    this.provider = config.provider;
    this.version = config.version;
    this.budgetResource = config.budgetResource;
    this.defaultBudgetSlice = config.budgetSlice;
    this.nar = config.nar;
    this.episodicMemory = config.episodicMemory;
    this.lmService = config.lmService;
    this.rlfpLearner = config.rlfpLearner;

    if (this.lmService || this.nar || this.episodicMemory) {
      this.scenarioTools = createScenarioGenTools({
        nar: this.nar,
        episodicMemory: this.episodicMemory,
        lmService: this.lmService,
        rlfpLearner: this.rlfpLearner,
      });
    }
  }

  setPinStore(store: OraclePinStore): void {
    this.pinStore = store;
  }

  setReplayMode(replay: boolean): void {
    this.isReplay = replay;
  }

  async call(
    input: ImaginationGenerateInput | ImaginationRunInput | ImaginationProfilesInput,
    budgetSlice?: BudgetSlice
  ): Promise<OracleOutput<{ success: boolean; seed: string; profile: string; scenarios_generated: number; scenarios_executed: number; specs: ScenarioSpec[]; results: ScenarioResult[]; summary: { passed: number; failed: number; avg_reward: number } } | ScenarioResult | string[]>> {
    const effectiveBudgetSlice = budgetSlice ?? this.defaultBudgetSlice;
    if (effectiveBudgetSlice && this.budgetResource) {
      const { consume } = await import('../budget/budget.js');
      const charged = consume(effectiveBudgetSlice, this.budgetResource, 1);
      if (!charged) {
        const callId = crypto.randomUUID();
        const startTs = Date.now();
        this.stats.totalCalls++;
        this.stats.failedCalls++;
        const error = `Budget exhausted for ${this.budgetResource}`;
        return {
          value: null as any,
          meta: { callId, ts: startTs, durationMs: 0, provider: this.provider, version: this.version, pinned: false, error },
        };
      }
    }

    const callId = crypto.randomUUID();
    const startTs = Date.now();
    let pinned = false;
    let error: string | undefined;
    let value: { success: boolean; seed: string; profile: string; scenarios_generated: number; scenarios_executed: number; specs: ScenarioSpec[]; results: ScenarioResult[]; summary: { passed: number; failed: number; avg_reward: number } } | ScenarioResult | string[];

    this.stats.totalCalls++;

    try {
      if (this.isReplay && this.pinStore) {
        const pinnedValue = await this.pinStore.getPin(this.operation, input.args, this.provider, this.version, input.context);
        if (pinnedValue !== null) {
          this.stats.pinnedCalls++;
          this.stats.successfulCalls++;
          return {
            value: pinnedValue as any,
            meta: { callId, ts: startTs, durationMs: 0, provider: this.provider, version: this.version, pinned: true },
          };
        }
      }

      value = await this.execute(input);
      this.stats.successfulCalls++;

      if (!this.isReplay && this.pinStore) {
        await this.pinStore.pin(this.operation, this.hashInput(input.args), this.provider, this.version, input.context, value);
      }
    } catch (e) {
      this.stats.failedCalls++;
      error = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      const durationMs = Date.now() - startTs;
      this.stats.totalDurationMs += durationMs;
    }

    return {
      value,
      meta: { callId, ts: startTs, durationMs: Date.now() - startTs, provider: this.provider, version: this.version, pinned, error },
    };
  }

  private async execute(
    input: ImaginationGenerateInput | ImaginationRunInput | ImaginationProfilesInput
  ): Promise<{ success: boolean; seed: string; profile: string; scenarios_generated: number; scenarios_executed: number; specs: ScenarioSpec[]; results: ScenarioResult[]; summary: { passed: number; failed: number; avg_reward: number } } | ScenarioResult | string[]> {
    switch (this.operation) {
      case 'imagination.generate': {
        const args = input.args as [string, string?, number?];
        const [seed, profile = 'auto', count = 1] = args;
        if (!this.scenarioTools) throw new Error('Scenario tools not initialized (missing dependencies)');
        // The tool's execute method returns a Promise
        const result = await (this.scenarioTools.generate_scenarios.execute as any)({ seed, profile, count, injectEpisodes: true });
        return result as any;
      }

      case 'imagination.run': {
        const args = input.args as [ScenarioSpec];
        const [spec] = args;
        if (!this.nar) throw new Error('NAR instance not configured');
        const { runScenario, calculateScenarioReward, validators } = await import('../tools/adapters/scenario-execute.js');
        const result = await runScenario(this.nar, spec);
        const reward = calculateScenarioReward(result, spec);
        result.criteria_results = validators.reduce(
          (acc, v) => {
            const validation = v.validate(result, spec);
            acc[v.name] = validation.passed;
            return acc;
          },
          {} as Record<string, boolean>
        );
        if (this.episodicMemory) {
          // injectScenarioEpisodes is not exported, replicate its logic here
          try {
            await this.episodicMemory.log(
              'error',
              `Scenario ${spec.name} ${result.success ? 'passed' : 'failed'}`,
              {
                type: 'scenario_result',
                scenario: spec.name,
                profile: spec.metadata.profile,
                success: result.success,
                steps: result.steps_executed,
                duration_ms: result.duration_ms,
                contradictions: result.contradictions_detected,
                events: result.cognitive_events,
                derivations: result.derived_beliefs.length,
                reward,
                criteria: result.criteria_results,
              }
            );

            if (!result.success) {
              await this.episodicMemory.log('error', `(^fixScenario("${spec.name}"))!`, {
                type: 'fix_scenario_goal',
                scenario: spec.name,
                errors: [result.error ?? 'Unknown failure'],
              });
            }
          } catch (error: unknown) {
            console.warn('Failed to inject scenario episodes', { error });
          }
        }
        if (this.rlfpLearner) {
          this.rlfpLearner.reward(reward, `scenario:${spec.name}`);
        }
        return result;
      }

      case 'imagination.profiles': {
        const { SCENARIO_PROFILES } = await import('../tools/adapters/scenario-profiles.js');
        return [...SCENARIO_PROFILES] as string[];
      }

      default:
        throw new Error(`Unknown imagination operation: ${(input as any).operation}`);
    }
  }

  private hashInput(args: unknown[]): string {
    const json = JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v);
    return createHash('sha256').update(json).digest('hex').substring(0, 32);
  }

  async isAvailable(): Promise<boolean> {
    return this.scenarioTools !== null;
  }

  getStats() {
    return { ...this.stats };
  }
}

/** Create an imagination oracle for generation. */
export function createImaginationGenerateOracle(
  nar: any | undefined,
  episodicMemory: EpisodicMemory | undefined,
  lmService: ILMService | undefined,
  rlfpLearner: ImaginationOracleConfig['rlfpLearner'],
  config: Partial<Omit<ImaginationOracleConfig, 'operation' | 'nar' | 'episodicMemory' | 'lmService' | 'rlfpLearner'>> = {}
): ImaginationOracle {
  return new ImaginationOracle({
    operation: 'imagination.generate',
    provider: 'imagination',
    nar,
    episodicMemory,
    lmService,
    rlfpLearner,
    ...config,
  });
}

/** Create an imagination oracle for running. */
export function createImaginationRunOracle(
  nar: any,
  episodicMemory: EpisodicMemory | undefined,
  rlfpLearner: ImaginationOracleConfig['rlfpLearner'],
  config: Partial<Omit<ImaginationOracleConfig, 'operation' | 'nar' | 'episodicMemory' | 'rlfpLearner'>> = {}
): ImaginationOracle {
  return new ImaginationOracle({
    operation: 'imagination.run',
    provider: 'imagination',
    nar,
    episodicMemory,
    rlfpLearner,
    ...config,
  });
}

/** Create an imagination oracle for profiles. */
export function createImaginationProfilesOracle(
  config: Partial<Omit<ImaginationOracleConfig, 'operation'>> = {}
): ImaginationOracle {
  return new ImaginationOracle({
    operation: 'imagination.profiles',
    provider: 'imagination',
    ...config,
  });
}

/** Register all imagination oracles with the registry. */
export function registerImaginationOracles(
  nar: any | undefined,
  episodicMemory: EpisodicMemory | undefined,
  lmService: ILMService | undefined,
  rlfpLearner: ImaginationOracleConfig['rlfpLearner'],
  pinStore?: OraclePinStore
): ImaginationOracle[] {
  const oracles: ImaginationOracle[] = [
    createImaginationGenerateOracle(nar, episodicMemory, lmService, rlfpLearner),
    createImaginationRunOracle(nar!, episodicMemory, rlfpLearner),
    createImaginationProfilesOracle(),
  ];

  if (pinStore) {
    for (const oracle of oracles) {
      oracle.setPinStore(pinStore);
    }
  }

  const { oracleRegistry } = require('./oracle.js');
  for (const oracle of oracles) {
    oracleRegistry.register(oracle);
  }

  return oracles;
}