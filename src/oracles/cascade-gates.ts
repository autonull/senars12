/**
 * Cascade Gates Oracle — wraps groundedness gate, trace grader, wake gate, and
 * resource gate through the oracle seam.
 */

import { createHash } from 'crypto';
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from './oracle';
import type { BudgetSlice, BudgetResource } from '../budget/budget';
import { OraclePinStore } from './pins';
import { createGroundednessGate, type GroundednessGateOptions } from '../lm/system-one/groundedness-gate';
import { createTraceGrader, type TraceGraderOptions, type TraceGradeResult } from '../lm/system-one/trace-grader';
import { createWakeGate, type WakeGateOptions, type WakeVerdict } from '../lm/system-one/wake-gate';
import { chargeJudgment, type ResourceCost, type JudgmentBudgetVerdict } from '../lm/system-one/resource-gate';
import type { KernelBudgetGate } from '../kernel/KernelBudgetGate';
import type { EmbeddingCache, JudgmentManifold, ReasoningBudget } from '../lm/system-one/types';
import type { ContrastiveMemory } from '../lm/system-one/contrastive';
import type { AgentTrace } from '@senars/types/cognitive';
import type { EgressVerdict } from '@senars/util';
import { SenarsError } from '../errors/senars-error';


/** Input for groundedness check. */
export interface GroundednessCheckInput extends OracleInput {
  operation: 'cascade.groundedness';
  args: [narration: string, correlationId: string];
}

/** Input for trace grading. */
export interface TraceGradeInput extends OracleInput {
  operation: 'cascade.traceGrade';
  args: [trace: AgentTrace];
}

/** Input for wake gate. */
export interface WakeGateInput extends OracleInput {
  operation: 'cascade.wakeGate';
  args: [sleepNote: string, hint?: { userInput?: boolean }];
}

/** Input for resource charging. */
export interface ResourceChargeInput extends OracleInput {
  operation: 'cascade.resourceCharge';
  args: [scopeId: string, cost: ResourceCost];
}

/** Cascade Gates Oracle configuration. */
export interface CascadeGatesOracleConfig extends OracleConfig {
  operation: 'cascade.groundedness' | 'cascade.traceGrade' | 'cascade.wakeGate' | 'cascade.resourceCharge';
  manifold: JudgmentManifold;
  embeddingCache: EmbeddingCache;
  budgetGate?: KernelBudgetGate;
  budget?: ReasoningBudget;
  getContrastive?: (correlationId: string) => ContrastiveMemory;
  groundednessThreshold?: number;
  wakeThreshold?: number;
  notYetThreshold?: number;
}

/** Union of all possible return types for cascade gates. */
export type CascadeGatesResult = EgressVerdict | TraceGradeResult | WakeVerdict | JudgmentBudgetVerdict;

/** Cascade Gates Oracle implementation. */
export class CascadeGatesOracle implements Oracle<
  GroundednessCheckInput | TraceGradeInput | WakeGateInput | ResourceChargeInput,
  CascadeGatesResult
> {
  public readonly operation: CascadeGatesOracleConfig['operation'];
  public readonly provider: string;
  public readonly version?: string;
  public readonly budgetResource?: BudgetResource;

  private manifold: JudgmentManifold;
  private embeddingCache: EmbeddingCache;
  private budgetGate?: KernelBudgetGate;
  private budget?: ReasoningBudget;
  private getContrastive?: CascadeGatesOracleConfig['getContrastive'];
  private groundednessThreshold?: number;
  private wakeThreshold?: number;
  private notYetThreshold?: number;

  private groundednessGate: ReturnType<typeof createGroundednessGate> | null = null;
  private traceGrader: ReturnType<typeof createTraceGrader> | null = null;
  private wakeGate: ReturnType<typeof createWakeGate> | null = null;

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

  constructor(config: CascadeGatesOracleConfig) {
    this.operation = config.operation;
    this.provider = config.provider;
    this.version = config.version;
    this.budgetResource = config.budgetResource;
    this.defaultBudgetSlice = config.budgetSlice;
    this.manifold = config.manifold;
    this.embeddingCache = config.embeddingCache;
    this.budgetGate = config.budgetGate;
    this.budget = config.budget;
    this.getContrastive = config.getContrastive;
    this.groundednessThreshold = config.groundednessThreshold;
    this.wakeThreshold = config.wakeThreshold;
    this.notYetThreshold = config.notYetThreshold;

    this.initializeGates();
  }

  private initializeGates(): void {
    this.groundednessGate = createGroundednessGate({
      manifold: this.manifold,
      embeddingCache: this.embeddingCache,
      threshold: this.groundednessThreshold,
      getContrastive: this.getContrastive,
    });

    this.traceGrader = createTraceGrader({
      manifold: this.manifold,
      embeddingCache: this.embeddingCache,
      budget: this.budget,
      getContrastive: this.getContrastive,
    });

    this.wakeGate = createWakeGate({
      manifold: this.manifold,
      embeddingCache: this.embeddingCache,
      budget: this.budget,
      wakeThreshold: this.wakeThreshold,
      notYetThreshold: this.notYetThreshold,
    });
  }

  setPinStore(store: OraclePinStore): void {
    this.pinStore = store;
  }

  setReplayMode(replay: boolean): void {
    this.isReplay = replay;
  }

  async call(
    input: GroundednessCheckInput | TraceGradeInput | WakeGateInput | ResourceChargeInput,
    budgetSlice?: BudgetSlice
  ): Promise<OracleOutput<CascadeGatesResult>> {
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
    let value: CascadeGatesResult;

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
    input: GroundednessCheckInput | TraceGradeInput | WakeGateInput | ResourceChargeInput
  ): Promise<CascadeGatesResult> {
    switch (this.operation) {
      case 'cascade.groundedness': {
        const args = input.args as [string, string];
        const [narration, correlationId] = args;
        if (!this.groundednessGate) throw new SenarsError('Groundedness gate not initialized', 'OPERATION_ERROR');
        return this.groundednessGate(narration, correlationId);
      }

      case 'cascade.traceGrade': {
        const args = input.args as [import('@senars/types/cognitive').AgentTrace];
        const [trace] = args;
        if (!this.traceGrader) throw new SenarsError('Trace grader not initialized', 'OPERATION_ERROR');
        return this.traceGrader(trace);
      }

      case 'cascade.wakeGate': {
        const args = input.args as [string, { userInput?: boolean }?];
        const [sleepNote, hint] = args;
        if (!this.wakeGate) throw new SenarsError('Wake gate not initialized', 'OPERATION_ERROR');
        return this.wakeGate(sleepNote, hint);
      }

      case 'cascade.resourceCharge': {
        const args = input.args as [string, import('../lm/system-one/types').ResourceCost];
        const [scopeId, cost] = args;
        if (!this.budgetGate) throw new SenarsError('Budget gate not configured', 'CONFIGURATION_ERROR');
        return chargeJudgment(this.budgetGate, scopeId, cost);
      }

      default:
        throw new SenarsError(`Unknown cascade gates operation: ${(input as any).operation}`, 'VALIDATION_ERROR');
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

/** Create a cascade gates oracle for groundedness. */
export function createGroundednessOracle(
  manifold: JudgmentManifold,
  embeddingCache: EmbeddingCache,
  config: Partial<Omit<CascadeGatesOracleConfig, 'operation' | 'manifold' | 'embeddingCache'>> = {}
): CascadeGatesOracle {
  return new CascadeGatesOracle({
    operation: 'cascade.groundedness',
    provider: 'cascade-groundedness',
    manifold,
    embeddingCache,
    ...config,
  });
}

/** Create a cascade gates oracle for trace grading. */
export function createTraceGradeOracle(
  manifold: JudgmentManifold,
  embeddingCache: EmbeddingCache,
  config: Partial<Omit<CascadeGatesOracleConfig, 'operation' | 'manifold' | 'embeddingCache'>> = {}
): CascadeGatesOracle {
  return new CascadeGatesOracle({
    operation: 'cascade.traceGrade',
    provider: 'cascade-trace',
    manifold,
    embeddingCache,
    ...config,
  });
}

/** Create a cascade gates oracle for wake gate. */
export function createWakeGateOracle(
  manifold: JudgmentManifold,
  embeddingCache: EmbeddingCache,
  config: Partial<Omit<CascadeGatesOracleConfig, 'operation' | 'manifold' | 'embeddingCache'>> = {}
): CascadeGatesOracle {
  return new CascadeGatesOracle({
    operation: 'cascade.wakeGate',
    provider: 'cascade-wake',
    manifold,
    embeddingCache,
    ...config,
  });
}

/** Create a cascade gates oracle for resource charging. */
export function createResourceChargeOracle(
  manifold: JudgmentManifold,
  embeddingCache: EmbeddingCache,
  budgetGate: KernelBudgetGate,
  config: Partial<Omit<CascadeGatesOracleConfig, 'operation' | 'manifold' | 'embeddingCache' | 'budgetGate'>> = {}
): CascadeGatesOracle {
  return new CascadeGatesOracle({
    operation: 'cascade.resourceCharge',
    provider: 'cascade-resource',
    manifold,
    embeddingCache,
    budgetGate,
    ...config,
  });
}

/** Register all cascade gates oracles with the registry. */
export function registerCascadeGatesOracles(
  manifold: JudgmentManifold,
  embeddingCache: EmbeddingCache,
  budgetGate: KernelBudgetGate | undefined,
  getContrastive: CascadeGatesOracleConfig['getContrastive'],
  pinStore?: OraclePinStore
): CascadeGatesOracle[] {
  const oracles: CascadeGatesOracle[] = [
    createGroundednessOracle(manifold, embeddingCache, { getContrastive }),
    createTraceGradeOracle(manifold, embeddingCache, { getContrastive }),
    createWakeGateOracle(manifold, embeddingCache),
  ];

  if (budgetGate) {
    oracles.push(createResourceChargeOracle(manifold, embeddingCache, budgetGate));
  }

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