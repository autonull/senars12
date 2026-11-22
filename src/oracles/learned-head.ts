/**
 * Portable Learned-Head Runtime Oracle — wraps WASI head bundle loading and
 * evaluation through the oracle seam.
 */

import { createHash } from 'crypto';
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from './oracle.js';
import type { BudgetSlice, BudgetResource } from '../budget/budget.js';
import { OraclePinStore } from './pins.js';
import { loadHeadBundle, type LoadedHeadBundle, type HeadBundleArtifacts } from '../lm/system-one/wasi-head-bundle.js';
import { verifyModelDigest, composeModelDigest, encoderDigest, type HeadRuntimeConfig } from '../lm/system-one/wasi-runtime.js';

/** Input for loading a head bundle. */
export interface LearnedHeadLoadInput extends OracleInput {
  operation: 'learnedHead.load';
  args: [wasmPath: string, modelDigest: string, dimension: number, allowedPaths?: string[], timeoutMs?: number];
}

/** Input for evaluating with a loaded head. */
export interface LearnedHeadEvaluateInput extends OracleInput {
  operation: 'learnedHead.evaluate';
  args: [embedding: Float32Array];
}

/** Input for getting head health. */
export interface LearnedHeadHealthInput extends OracleInput {
  operation: 'learnedHead.health';
  args: [];
}

/** Learned Head Oracle configuration. */
export interface LearnedHeadOracleConfig extends OracleConfig {
  operation: 'learnedHead.load' | 'learnedHead.evaluate' | 'learnedHead.health';
  defaultConfig?: HeadRuntimeConfig;
}

/** Learned Head Oracle implementation. */
export class LearnedHeadOracle implements Oracle<
  LearnedHeadLoadInput | LearnedHeadEvaluateInput | LearnedHeadHealthInput,
  LoadedHeadBundle | number | { status: string; modelDigest: string; dimension: number }
> {
  public readonly operation: LearnedHeadOracleConfig['operation'];
  public readonly provider: string;
  public readonly version?: string;
  public readonly budgetResource?: BudgetResource;

  private loadedHead: LoadedHeadBundle | null = null;
  private currentConfig: HeadRuntimeConfig | null = null;
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

  constructor(config: LearnedHeadOracleConfig) {
    this.operation = config.operation;
    this.provider = config.provider;
    this.version = config.version;
    this.budgetResource = config.budgetResource;
    this.defaultBudgetSlice = config.budgetSlice;
    this.currentConfig = config.defaultConfig ?? null;
  }

  setPinStore(store: OraclePinStore): void {
    this.pinStore = store;
  }

  setReplayMode(replay: boolean): void {
    this.isReplay = replay;
  }

  async call(
    input: LearnedHeadLoadInput | LearnedHeadEvaluateInput | LearnedHeadHealthInput,
    budgetSlice?: BudgetSlice
  ): Promise<OracleOutput<LoadedHeadBundle | number | { status: string; modelDigest: string; dimension: number }>> {
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
    let value: LoadedHeadBundle | number | { status: string; modelDigest: string; dimension: number };

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
    input: LearnedHeadLoadInput | LearnedHeadEvaluateInput | LearnedHeadHealthInput
  ): Promise<LoadedHeadBundle | number | { status: string; modelDigest: string; dimension: number }> {
    switch (this.operation) {
      case 'learnedHead.load': {
        const args = input.args as [string, string, number, string[]?, number?];
        const [wasmPath, modelDigest, dimension, allowedPaths, timeoutMs] = args;
        this.currentConfig = {
          provider: 'wasi',
          modelDigest,
          timeoutMs,
          allowedPaths,
        };
        this.loadedHead = await loadHeadBundle({ wasmPath, modelDigest, dimension, allowedPaths, timeoutMs });
        return this.loadedHead;
      }

      case 'learnedHead.evaluate': {
        const args = input.args as [Float32Array];
        const [embedding] = args;
        if (!this.loadedHead) throw new Error('Head bundle not loaded');
        return this.loadedHead.evaluate(embedding);
      }

      case 'learnedHead.health': {
        if (!this.loadedHead || !this.currentConfig) {
          return { status: 'unloaded', modelDigest: '', dimension: 0 };
        }
        return {
          status: 'loaded',
          modelDigest: this.currentConfig.modelDigest ?? '',
          dimension: this.currentConfig.timeoutMs ?? 0, // reuse field for dimension storage
        };
      }

      default:
        throw new Error(`Unknown learned-head operation: ${(input as any).operation}`);
    }
  }

  private hashInput(args: unknown[]): string {
    const json = JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v);
    return createHash('sha256').update(json).digest('hex').substring(0, 32);
  }

  async isAvailable(): Promise<boolean> {
    return this.loadedHead !== null;
  }

  getStats() {
    return { ...this.stats };
  }
}

/** Create a learned-head oracle for loading. */
export function createLearnedHeadLoadOracle(
  config: Partial<Omit<LearnedHeadOracleConfig, 'operation'>> = {}
): LearnedHeadOracle {
  return new LearnedHeadOracle({
    operation: 'learnedHead.load',
    provider: 'learned-head',
    ...config,
  });
}

/** Create a learned-head oracle for evaluation. */
export function createLearnedHeadEvaluateOracle(
  config: Partial<Omit<LearnedHeadOracleConfig, 'operation'>> = {}
): LearnedHeadOracle {
  return new LearnedHeadOracle({
    operation: 'learnedHead.evaluate',
    provider: 'learned-head',
    ...config,
  });
}

/** Create a learned-head oracle for health. */
export function createLearnedHeadHealthOracle(
  config: Partial<Omit<LearnedHeadOracleConfig, 'operation'>> = {}
): LearnedHeadOracle {
  return new LearnedHeadOracle({
    operation: 'learnedHead.health',
    provider: 'learned-head',
    ...config,
  });
}

/** Register all learned-head oracles with the registry. */
export function registerLearnedHeadOracles(
  pinStore?: OraclePinStore
): LearnedHeadOracle[] {
  const oracles: LearnedHeadOracle[] = [
    createLearnedHeadLoadOracle(),
    createLearnedHeadEvaluateOracle(),
    createLearnedHeadHealthOracle(),
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