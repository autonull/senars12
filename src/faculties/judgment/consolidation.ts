/**
 * Judgment Consolidation — ensures the learned judge is the single
 * consolidation point for learned judgment paths.
 *
 * Other judgment paths (ingress, trace-grader, decide, pipeline) defer
 * to the cascade's learned judge after trained parity is achieved.
 */

import type { JudgmentCandidate, JudgmentContext, JudgmentResult } from './cascade';
import { createJudge, type JudgeEnsemble, type JudgeModel, type JudgeTrainingExample, type IsotonicCalibrator } from './judge';
import type { CalibrationManager } from './calibration';
import type { TelemetryCollector } from './telemetry';
import type { Clock, IDGenerator, TimestampMs } from '../../kernel/env';
import { createCalibrationManager } from './calibration';
import { createTelemetryCollector } from './telemetry';

/** Parity status for a judgment path. */
export interface ParityStatus {
  /** Path identifier. */
  path: string;
  /** Brier score on holdout. */
  brierScore: number;
  /** ECE on holdout. */
  ece: number;
  /** Whether parity with learned judge is achieved. */
  parityAchieved: boolean;
  /** Last evaluated. */
  evaluatedAt: number;
}

/** Consolidation configuration. */
export interface ConsolidationConfig {
  /** Brier threshold for parity (lower is better). */
  brierThreshold: number;
  /** ECE threshold for parity. */
  eceThreshold: number;
  /** Minimum training examples for learned judge. */
  minTrainingExamples: number;
  /** Auto-consolidate when parity achieved. */
  autoConsolidate: boolean;
}

/** Default consolidation config. */
export const defaultConsolidationConfig: ConsolidationConfig = {
  brierThreshold: 0.05,
  eceThreshold: 0.1,
  minTrainingExamples: 100,
  autoConsolidate: true,
};

/** Judgment consolidation manager. */
export class JudgmentConsolidation {
  private config: ConsolidationConfig;
  private learnedJudge: JudgeEnsemble;
  private calibrators: Map<string, IsotonicCalibrator> = new Map();
  private calibrationManager: CalibrationManager;
  private telemetry: TelemetryCollector;
  private clock: Clock;
  private ids: IDGenerator;

  /** Parity status for each judgment path. */
  private parityStatus = new Map<string, ParityStatus>();

  /** Training examples for learned judge. */
  private trainingBuffer: JudgeTrainingExample[] = [];

  /** Whether consolidation is active. */
  private consolidated = false;

  constructor(
    config: ConsolidationConfig = defaultConsolidationConfig,
    options: {
      clock?: Clock;
      ids?: IDGenerator;
      calibrationManager?: CalibrationManager;
      telemetry?: TelemetryCollector;
    } = {}
  ) {
    this.config = config;
    this.clock = options.clock ?? { now: () => Date.now() as TimestampMs, setTime: () => {}, advance: () => {} };
    this.ids = options.ids ?? { uuid: () => crypto.randomUUID(), short: () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    this.calibrationManager = options.calibrationManager ?? createCalibrationManager({ method: 'isotonic' });
    this.telemetry = options.telemetry ?? createTelemetryCollector();

    // Create the learned judge as the consolidation target
    this.learnedJudge = createJudge({
      rng: () => this.clock.now() / 1000000,
      now: () => this.clock.now(),
      telemetry: this.telemetry,
    });
  }

  /** Get the consolidated learned judge. */
  getLearnedJudge(): JudgeEnsemble {
    return this.learnedJudge;
  }

  /** Register a judgment path for parity evaluation. */
  registerPath(path: string): void {
    if (!this.parityStatus.has(path)) {
      this.parityStatus.set(path, {
        path,
        brierScore: Infinity,
        ece: Infinity,
        parityAchieved: false,
        evaluatedAt: 0,
      });
    }
  }

  /** Evaluate parity for a judgment path. */
  async evaluateParity(
    path: string,
    testExamples: JudgeTrainingExample[],
    predictor: (candidate: JudgmentCandidate, context: JudgmentContext) => number
  ): Promise<ParityStatus> {
    if (testExamples.length === 0) {
      throw new Error('No test examples provided for parity evaluation');
    }

    let brierSum = 0;
    let eceSum = 0;
    let samples = 0;

    // Bin predictions for ECE calculation
    const bins = new Map<number, { correct: number; total: number }>();

    for (const ex of testExamples) {
      const predicted = predictor(ex.candidate, ex.context);
      const observed = ex.correct ? 1 : 0;

      // Brier score
      brierSum += (predicted - observed) ** 2;

      // ECE bins
      const bin = Math.round(predicted * 10) / 10;
      const entry = bins.get(bin) ?? { correct: 0, total: 0 };
      entry.total++;
      if (ex.correct) entry.correct++;
      bins.set(bin, entry);

      samples++;
    }

    const brierScore = brierSum / samples;

    // Compute ECE
    for (const [, { correct, total }] of bins) {
      if (total > 0) {
        const predicted = Array.from(bins.keys()).find(k => Math.abs(k - (correct / total)) < 0.05) ?? 0;
        eceSum += Math.abs(predicted - correct / total) * (total / samples);
      }
    }
    const ece = eceSum;

    const status: ParityStatus = {
      path,
      brierScore,
      ece,
      parityAchieved: brierScore <= this.config.brierThreshold &&
        ece <= this.config.eceThreshold &&
        this.trainingBuffer.length >= this.config.minTrainingExamples,
      evaluatedAt: this.clock.now(),
    };

    this.parityStatus.set(path, status);

    // Emit telemetry
    if (this.telemetry) {
      await this.telemetry.parityEvaluated(path, status);
    }

    // Auto-consolidate if enabled and parity achieved
    if (this.config.autoConsolidate && status.parityAchieved && !this.consolidated) {
      await this.consolidate();
    }

    return status;
  }

  /** Consolidate judgment paths into the learned judge. */
  async consolidate(): Promise<void> {
    if (this.consolidated) return;

    // Train learned judge on accumulated examples
    if (this.trainingBuffer.length > 0) {
      await this.learnedJudge.train(this.trainingBuffer);
      this.trainingBuffer = [];
    }

    // Mark all paths as consolidated
    for (const [path, status] of this.parityStatus) {
      if (status.parityAchieved) {
        this.parityStatus.set(path, { ...status, parityAchieved: true });
      }
    }

    this.consolidated = true;

    if (this.telemetry) {
      await this.telemetry.consolidationComplete(this.parityStatus.size);
    }
  }

  /** Add training example for learned judge. */
  addTrainingExample(example: JudgeTrainingExample): void {
    this.trainingBuffer.push(example);
  }

  /** Get parity status for all paths. */
  getParityStatus(): Map<string, ParityStatus> {
    return new Map(this.parityStatus);
  }

  /** Check if a path should defer to learned judge. */
  shouldDeferToLearnedJudge(path: string): boolean {
    const status = this.parityStatus.get(path);
    return status?.parityAchieved ?? false;
  }

  /** Get consolidation status. */
  isConsolidated(): boolean {
    return this.consolidated;
  }

  /** Get learned judge info. */
  getLearnedJudgeInfo() {
    return this.learnedJudge.getInfo();
  }

  /** Get calibration manager. */
  getCalibrationManager(): CalibrationManager {
    return this.calibrationManager;
  }

  /** Get telemetry collector. */
  getTelemetry(): TelemetryCollector {
    return this.telemetry;
  }
}

/** Create a judgment consolidation manager. */
export function createJudgmentConsolidation(
  config?: ConsolidationConfig,
  options?: {
    clock?: Clock;
    ids?: IDGenerator;
    calibrationManager?: CalibrationManager;
    telemetry?: TelemetryCollector;
  }
): JudgmentConsolidation {
  return new JudgmentConsolidation(config, options);
}

/** Global consolidation instance (convenience; prefer {@link createJudgmentConsolidation}). */
export const judgmentConsolidation = createJudgmentConsolidation();

/** Convenience function to get the consolidated learned judge. */
export function getConsolidatedLearnedJudge(): JudgeEnsemble {
  return judgmentConsolidation.getLearnedJudge();
}

/** Convenience function to check if a path should defer. */
export function shouldDeferToLearnedJudge(path: string): boolean {
  return judgmentConsolidation.shouldDeferToLearnedJudge(path);
}

/** Convenience function to add training example. */
export function addLearnedJudgeTrainingExample(example: JudgeTrainingExample): void {
  judgmentConsolidation.addTrainingExample(example);
}