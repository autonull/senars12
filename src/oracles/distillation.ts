/**
 * Distillation Lane Oracle — wraps the distillation pipeline (dataset, training,
 * calibration, bake-off, governed promotion) through the oracle seam.
 */

import { createHash } from 'crypto';
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from './oracle.js';
import type { BudgetSlice, BudgetResource } from '../budget/budget.js';
import { OraclePinStore } from './pins.js';
import type { JudgmentDataset, DistillationLabel } from '../lm/system-one/distill.js';
import type { HeadCandidateSpec, BakeOffCase, BakeOffResult, SabotageVerdict } from '../lm/system-one/distill.js';
import type { IsotonicCalibrator } from '../lm/system-one/calibration.js';
import type { CalibrationLock } from '../lm/system-one/calibration-fit.js';
import { fitCalibrationLock, readCalibrationLockOrNull, applyCalibrationLock, assertLockMatches, CALIBRATION_LOCK_PATH } from '../lm/system-one/calibration-fit.js';
import { runBakeOff, validateHeadCandidate, buildHeadSwapProposal, buildSabotageFlag } from '../lm/system-one/distill.js';
import type { SelfImprovementProposal } from '@senars/schemas';

/** Input for recording distillation labels. */
export interface DistillationRecordInput extends OracleInput {
  operation: 'distillation.record';
  args: [label: DistillationLabel, embedding?: Float32Array];
}

/** Input for fitting calibration. */
export interface DistillationFitInput extends OracleInput {
  operation: 'distillation.fitCalibration';
  args: [options?: {
    headIds?: readonly string[];
    holdoutFraction?: number;
    seed?: number;
    calibrationVersion?: string;
    minRows?: number;
  }];
}

/** Input for running bake-off. */
export interface DistillationBakeOffInput extends OracleInput {
  operation: 'distillation.bakeOff';
  args: [incumbent: HeadCandidateSpec | undefined, candidate: HeadCandidateSpec, cases: readonly BakeOffCase[], options?: {
    parityTolerance?: number;
    eceBound?: number;
    acceptImprovements?: boolean;
    frozen?: { cases: readonly BakeOffCase[]; tolerance?: number };
  }];
}

/** Input for validating head candidate. */
export interface DistillationValidateInput extends OracleInput {
  operation: 'distillation.validateHead';
  args: [candidate: HeadCandidateSpec, incumbent?: HeadCandidateSpec];
}

/** Input for loading calibration lock. */
export interface DistillationLoadLockInput extends OracleInput {
  operation: 'distillation.loadLock';
  args: [modelDigest: string];
}

/** Input for applying calibration lock. */
export interface DistillationApplyLockInput extends OracleInput {
  operation: 'distillation.applyLock';
  args: [lock: CalibrationLock];
}

/** Distillation Oracle configuration. */
export interface DistillationOracleConfig extends OracleConfig {
  operation: 'distillation.record' | 'distillation.fitCalibration' | 'distillation.bakeOff' | 'distillation.validateHead' | 'distillation.loadLock' | 'distillation.applyLock';
  dataset: JudgmentDataset;
  calibrators?: Map<string, IsotonicCalibrator>;
}

/** Distillation Oracle implementation. */
export class DistillationOracle implements Oracle<
  DistillationRecordInput | DistillationFitInput | DistillationBakeOffInput | DistillationValidateInput | DistillationLoadLockInput | DistillationApplyLockInput,
  void | { lock: CalibrationLock; perHead: Map<string, IsotonicCalibrator>; improved: boolean } | BakeOffResult | SabotageVerdict | CalibrationLock | null
> {
  public readonly operation: DistillationOracleConfig['operation'];
  public readonly provider: string;
  public readonly version?: string;
  public readonly budgetResource?: BudgetResource;

  private dataset: JudgmentDataset;
  private calibrators?: Map<string, IsotonicCalibrator>;
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

  constructor(config: DistillationOracleConfig) {
    this.operation = config.operation;
    this.provider = config.provider;
    this.version = config.version;
    this.budgetResource = config.budgetResource;
    this.defaultBudgetSlice = config.budgetSlice;
    this.dataset = config.dataset;
    this.calibrators = config.calibrators;
  }

  setPinStore(store: OraclePinStore): void {
    this.pinStore = store;
  }

  setReplayMode(replay: boolean): void {
    this.isReplay = replay;
  }

  async call(
    input: DistillationRecordInput | DistillationFitInput | DistillationBakeOffInput | DistillationValidateInput | DistillationLoadLockInput | DistillationApplyLockInput,
    budgetSlice?: BudgetSlice
  ): Promise<OracleOutput<void | { lock: CalibrationLock; perHead: Map<string, IsotonicCalibrator>; improved: boolean } | BakeOffResult | SabotageVerdict | CalibrationLock | null>> {
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
    let value: void | { lock: CalibrationLock; perHead: Map<string, IsotonicCalibrator>; improved: boolean } | BakeOffResult | SabotageVerdict | CalibrationLock | null;

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
    input: DistillationRecordInput | DistillationFitInput | DistillationBakeOffInput | DistillationValidateInput | DistillationLoadLockInput | DistillationApplyLockInput
  ): Promise<void | { lock: CalibrationLock; perHead: Map<string, IsotonicCalibrator>; improved: boolean } | BakeOffResult | SabotageVerdict | CalibrationLock | null> {
    // Type-safe argument extraction using the operation as discriminant
    switch (this.operation) {
      case 'distillation.record': {
        const args = input.args as [DistillationLabel, Float32Array?];
        const [label, embedding] = args;
        this.dataset.record(label, embedding);
        return;
      }

      case 'distillation.fitCalibration': {
        const args = input.args as [DistillationFitInput['args'][0]?];
        const [options] = args;
        if (!this.calibrators) throw new Error('Calibrators not configured');
        // Cast options to FitCalibrationOptions with proper types
        const fitOptions = options as import('../lm/system-one/calibration-fit.js').FitCalibrationOptions | undefined;
        const result = fitCalibrationLock(this.dataset, fitOptions);
        // Apply the fitted lock to our calibrators
        applyCalibrationLock(this.calibrators, result.lock);
        return result;
      }

      case 'distillation.bakeOff': {
        const args = input.args as [HeadCandidateSpec | undefined, HeadCandidateSpec, readonly BakeOffCase[], DistillationBakeOffInput['args'][3]?];
        const [incumbent, candidate, cases, options] = args;
        return runBakeOff(incumbent, candidate, cases, options?.parityTolerance, options?.eceBound, options?.acceptImprovements, options?.frozen);
      }

      case 'distillation.validateHead': {
        const args = input.args as [HeadCandidateSpec, HeadCandidateSpec?];
        const [candidate, incumbent] = args;
        return validateHeadCandidate(candidate, incumbent);
      }

      case 'distillation.loadLock': {
        const args = input.args as [string];
        const [modelDigest] = args;
        const lock = await readCalibrationLockOrNull(CALIBRATION_LOCK_PATH);
        if (lock) {
          assertLockMatches(lock, modelDigest as import('../lm/system-one/types.js').ModelDigest);
        }
        return lock;
      }

      case 'distillation.applyLock': {
        const args = input.args as [CalibrationLock];
        const [lock] = args;
        if (!this.calibrators) throw new Error('Calibrators not configured');
        applyCalibrationLock(this.calibrators, lock);
        return lock;
      }

      default:
        throw new Error(`Unknown distillation operation: ${(input as any).operation}`);
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

/** Create a distillation oracle for recording labels. */
export function createDistillationRecordOracle(
  dataset: JudgmentDataset,
  config: Partial<Omit<DistillationOracleConfig, 'operation' | 'dataset'>> = {}
): DistillationOracle {
  return new DistillationOracle({
    operation: 'distillation.record',
    provider: 'distillation',
    dataset,
    ...config,
  });
}

/** Create a distillation oracle for fitting calibration. */
export function createDistillationFitOracle(
  dataset: JudgmentDataset,
  calibrators: Map<string, IsotonicCalibrator>,
  config: Partial<Omit<DistillationOracleConfig, 'operation' | 'dataset'>> = {}
): DistillationOracle {
  return new DistillationOracle({
    operation: 'distillation.fitCalibration',
    provider: 'distillation',
    dataset,
    calibrators,
    ...config,
  });
}

/** Create a distillation oracle for bake-off. */
export function createDistillationBakeOffOracle(
  dataset: JudgmentDataset,
  config: Partial<Omit<DistillationOracleConfig, 'operation' | 'dataset'>> = {}
): DistillationOracle {
  return new DistillationOracle({
    operation: 'distillation.bakeOff',
    provider: 'distillation',
    dataset,
    ...config,
  });
}

/** Create a distillation oracle for head validation. */
export function createDistillationValidateOracle(
  dataset: JudgmentDataset,
  config: Partial<Omit<DistillationOracleConfig, 'operation' | 'dataset'>> = {}
): DistillationOracle {
  return new DistillationOracle({
    operation: 'distillation.validateHead',
    provider: 'distillation',
    dataset,
    ...config,
  });
}

/** Create a distillation oracle for lock loading. */
export function createDistillationLoadLockOracle(
  dataset: JudgmentDataset,
  config: Partial<Omit<DistillationOracleConfig, 'operation' | 'dataset'>> = {}
): DistillationOracle {
  return new DistillationOracle({
    operation: 'distillation.loadLock',
    provider: 'distillation',
    dataset,
    ...config,
  });
}

/** Create a distillation oracle for lock application. */
export function createDistillationApplyLockOracle(
  dataset: JudgmentDataset,
  calibrators: Map<string, IsotonicCalibrator>,
  config: Partial<Omit<DistillationOracleConfig, 'operation' | 'dataset'>> = {}
): DistillationOracle {
  return new DistillationOracle({
    operation: 'distillation.applyLock',
    provider: 'distillation',
    dataset,
    calibrators,
    ...config,
  });
}

/** Register all distillation oracles with the registry. */
export function registerDistillationOracles(
  dataset: JudgmentDataset,
  calibrators: Map<string, IsotonicCalibrator> | undefined,
  pinStore?: OraclePinStore
): DistillationOracle[] {
  const oracles: DistillationOracle[] = [
    createDistillationRecordOracle(dataset),
    createDistillationFitOracle(dataset, calibrators ?? new Map()),
    createDistillationBakeOffOracle(dataset),
    createDistillationValidateOracle(dataset),
    createDistillationLoadLockOracle(dataset),
  ];

  if (calibrators) {
    oracles.push(createDistillationApplyLockOracle(dataset, calibrators));
  }

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