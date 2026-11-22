/**
 * Credit Assignment Strategy Oracle — wraps MC-return labeling and manifold RL
 * agent through the oracle seam.
 */

import { createHash } from 'crypto';
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from './oracle';
import type { BudgetSlice, BudgetResource } from '../budget/budget';
import { OraclePinStore } from './pins';
import { mcReturns, recordMcReturnLabels, type McReturnInput } from '../lm/system-one/mc-return';
import { ManifoldRLAgent, type ManifoldRLAgentOptions, type ManifoldRLDecision } from '../lm/system-one/manifold-rl-agent';
import type { JudgmentDataset } from '../lm/system-one/distill';
import type { EmbeddingCache, EmbeddingPointer, JudgmentManifold, ReasoningBudget } from '../lm/system-one/types';
import type { Game, GameOutcome } from '../game/Game';

/** Input for computing MC returns. */
export interface CreditAssignmentMcReturnInput extends OracleInput {
  operation: 'creditAssignment.mcReturn';
  args: [episodeId: string, ticks: readonly { action: string; reward: number }[], gamma?: number];
}

/** Input for recording MC return labels. */
export interface CreditAssignmentRecordMcReturnInput extends OracleInput {
  operation: 'creditAssignment.recordMcReturn';
  args: [input: McReturnInput];
}

/** Input for RL agent decision. */
export interface CreditAssignmentDecideInput extends OracleInput {
  operation: 'creditAssignment.decide';
  args: [gameState: unknown]; // Game<S, A> but we can't serialize generics
}

/** Input for RL agent step. */
export interface CreditAssignmentStepInput extends OracleInput {
  operation: 'creditAssignment.step';
  args: [gameState: unknown];
}

/** Input for running RL episode. */
export interface CreditAssignmentRunEpisodeInput extends OracleInput {
  operation: 'creditAssignment.runEpisode';
  args: [gameState: unknown, maxSteps?: number];
}

/** Credit Assignment Oracle configuration. */
export interface CreditAssignmentOracleConfig extends OracleConfig {
  operation: 'creditAssignment.mcReturn' | 'creditAssignment.recordMcReturn' | 'creditAssignment.decide' | 'creditAssignment.step' | 'creditAssignment.runEpisode';
  cache: EmbeddingCache;
  manifold: JudgmentManifold;
  budget: ReasoningBudget;
  dataset?: JudgmentDataset;
  agentOptions?: Partial<ManifoldRLAgentOptions>;
}

/** Credit Assignment Oracle implementation. */
export class CreditAssignmentOracle implements Oracle<
  CreditAssignmentMcReturnInput | CreditAssignmentRecordMcReturnInput | CreditAssignmentDecideInput | CreditAssignmentStepInput | CreditAssignmentRunEpisodeInput,
  number[] | number[] | { action: unknown; values: Map<string, number>; feasible: Map<string, boolean>; risks: Map<string, number>; pointer: EmbeddingPointer; stateId: string } | ManifoldRLDecision | number
> {
  public readonly operation: CreditAssignmentOracleConfig['operation'];
  public readonly provider: string;
  public readonly version?: string;
  public readonly budgetResource?: BudgetResource;

  private cache: EmbeddingCache;
  private manifold: JudgmentManifold;
  private budget: ReasoningBudget;
  private dataset?: JudgmentDataset;
  private agent: ManifoldRLAgent | null = null;
  private agentOptions?: Partial<ManifoldRLAgentOptions>;

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

  constructor(config: CreditAssignmentOracleConfig) {
    this.operation = config.operation;
    this.provider = config.provider;
    this.version = config.version;
    this.budgetResource = config.budgetResource;
    this.defaultBudgetSlice = config.budgetSlice;
    this.cache = config.cache;
    this.manifold = config.manifold;
    this.budget = config.budget;
    this.dataset = config.dataset;
    this.agentOptions = config.agentOptions;

    if (config.operation !== 'creditAssignment.mcReturn' && config.operation !== 'creditAssignment.recordMcReturn') {
      this.agent = new ManifoldRLAgent({
        cache: this.cache,
        manifold: this.manifold,
        budget: this.budget,
        dataset: this.dataset,
        ...this.agentOptions,
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
    input: CreditAssignmentMcReturnInput | CreditAssignmentRecordMcReturnInput | CreditAssignmentDecideInput | CreditAssignmentStepInput | CreditAssignmentRunEpisodeInput,
    budgetSlice?: BudgetSlice
  ): Promise<OracleOutput<number[] | number[] | { action: unknown; values: Map<string, number>; feasible: Map<string, boolean>; risks: Map<string, number>; pointer: EmbeddingPointer; stateId: string } | ManifoldRLDecision | number>> {
    const effectiveBudgetSlice = budgetSlice ?? this.defaultBudgetSlice;
    if (effectiveBudgetSlice && this.budgetResource) {
      const { consume } = await import('../budget/budget');
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
    let value: number[] | number[] | { action: unknown; values: Map<string, number>; feasible: Map<string, boolean>; risks: Map<string, number>; pointer: EmbeddingPointer; stateId: string } | ManifoldRLDecision | number;

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
    input: CreditAssignmentMcReturnInput | CreditAssignmentRecordMcReturnInput | CreditAssignmentDecideInput | CreditAssignmentStepInput | CreditAssignmentRunEpisodeInput
  ): Promise<number[] | number[] | { action: unknown; values: Map<string, number>; feasible: Map<string, boolean>; risks: Map<string, number>; pointer: EmbeddingPointer; stateId: string } | ManifoldRLDecision | number> {
    switch (this.operation) {
      case 'creditAssignment.mcReturn': {
        const args = input.args as [string, readonly { action: string; reward: number }[], number?];
        const [episodeId, ticks, gamma] = args;
        return mcReturns(ticks, gamma);
      }

      case 'creditAssignment.recordMcReturn': {
        const args = input.args as [McReturnInput];
        const [mcInput] = args;
        if (!this.dataset) throw new Error('Dataset not configured for recording');
        return recordMcReturnLabels(this.dataset, mcInput);
      }

      case 'creditAssignment.decide': {
        const [gameState] = input.args;
        if (!this.agent) throw new Error('RL agent not initialized');
        // We can't directly call decide with a serialized game state
        // This would need a game registry or factory
        throw new Error('Decide requires live Game instance - use step or runEpisode instead');
      }

      case 'creditAssignment.step': {
        const [gameState] = input.args;
        if (!this.agent) throw new Error('RL agent not initialized');
        // Same issue - need live Game instance
        throw new Error('Step requires live Game instance');
      }

      case 'creditAssignment.runEpisode': {
        const [gameState, maxSteps] = input.args;
        if (!this.agent) throw new Error('RL agent not initialized');
        throw new Error('RunEpisode requires live Game instance');
      }

      default:
        throw new Error(`Unknown credit assignment operation: ${(input as any).operation}`);
    }
  }

  private hashInput(args: unknown[]): string {
    const json = JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v);
    return createHash('sha256').update(json).digest('hex').substring(0, 32);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getStats() {
    return { ...this.stats };
  }
}

/** Create a credit assignment oracle for MC returns. */
export function createCreditAssignmentMcReturnOracle(
  config: Partial<Omit<CreditAssignmentOracleConfig, 'operation'>> = {}
): CreditAssignmentOracle {
  return new CreditAssignmentOracle({
    operation: 'creditAssignment.mcReturn',
    provider: 'credit-assignment',
    cache: config.cache!,
    manifold: config.manifold!,
    budget: config.budget!,
    ...config,
  });
}

/** Create a credit assignment oracle for recording MC returns. */
export function createCreditAssignmentRecordOracle(
  cache: EmbeddingCache,
  manifold: JudgmentManifold,
  budget: ReasoningBudget,
  dataset: JudgmentDataset,
  config: Partial<Omit<CreditAssignmentOracleConfig, 'operation' | 'cache' | 'manifold' | 'budget' | 'dataset'>> = {}
): CreditAssignmentOracle {
  return new CreditAssignmentOracle({
    operation: 'creditAssignment.recordMcReturn',
    provider: 'credit-assignment',
    cache,
    manifold,
    budget,
    dataset,
    ...config,
  });
}

/** Create a credit assignment oracle for RL agent. */
export function createCreditAssignmentAgentOracle(
  cache: EmbeddingCache,
  manifold: JudgmentManifold,
  budget: ReasoningBudget,
  dataset: JudgmentDataset | undefined,
  agentOptions: Partial<ManifoldRLAgentOptions> = {},
  config: Partial<Omit<CreditAssignmentOracleConfig, 'operation' | 'cache' | 'manifold' | 'budget' | 'dataset' | 'agentOptions'>> = {}
): CreditAssignmentOracle {
  return new CreditAssignmentOracle({
    operation: 'creditAssignment.step', // Default to step, but agent handles all
    provider: 'credit-assignment',
    cache,
    manifold,
    budget,
    dataset,
    agentOptions,
    ...config,
  });
}

/** Register all credit assignment oracles with the registry. */
export function registerCreditAssignmentOracles(
  cache: EmbeddingCache,
  manifold: JudgmentManifold,
  budget: ReasoningBudget,
  dataset: JudgmentDataset | undefined,
  agentOptions: Partial<ManifoldRLAgentOptions> = {},
  pinStore?: OraclePinStore
): CreditAssignmentOracle[] {
  const oracles: CreditAssignmentOracle[] = [
    createCreditAssignmentMcReturnOracle({ cache, manifold, budget, dataset, agentOptions }),
    createCreditAssignmentRecordOracle(cache, manifold, budget, dataset!),
  ];

  // Note: agent operations need live Game instances, so we register a combined oracle
  // that can handle decide/step/runEpisode when a game is provided
  const agentOracle = createCreditAssignmentAgentOracle(cache, manifold, budget, dataset, agentOptions);
  oracles.push(agentOracle);

  if (pinStore) {
    for (const oracle of oracles) {
      oracle.setPinStore(pinStore);
    }
  }

  const { oracleRegistry } = require('./oracle');
  for (const oracle of oracles) {
    oracleRegistry.register(oracle);
  }

  return oracles;
}