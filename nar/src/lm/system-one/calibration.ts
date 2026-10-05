import { BoundedMap, lerp, maxScore, safeRatio, sortBy, trimCapped } from '@senars/util';
import { headRubrics } from './head-ontology.js';
import { weightedAbsoluteError } from './metrics.js';
import type { CalibrationVersion, RubricId } from './types.js';

/** Fitted points retained per calibrator; older points stop steering the fit. */
const CALIBRATION_POINT_CAP = 10_000;

export interface CalibrationPoint {
  predicted: number;
  observed: number;
  weight: number;
}

export interface IsotonicCalibrator {
  readonly version: CalibrationVersion;
  readonly rubric: RubricId | 'classify';
  readonly fitted: boolean;
  calibrate(score: number): number;
  update(points: CalibrationPoint[]): void;
  getECE(): number;
  getPoints(): ReadonlyArray<CalibrationPoint>;
  reset(): void;
}

export interface RollingECEConfig {
  /** Window width in minutes; a sample older than this is out. */
  windowSize: number;
  /**
   * Hard cap on retained samples. The width alone bounds the window in time but
   * not in count: a run recording every batch could put thousands of samples
   * inside one window, and the reading would then be dominated by whichever
   * samples fitted. The cap is the AIKR answer — bound both axes.
   */
  maxSamples: number;
  minSamples: number;
  driftThreshold: number;
}

export interface DriftDemotionConfig {
  eceThreshold: number;
  consecutiveCycles: number;
  cooldownCycles: number;
}

export interface BackendHealth {
  backendId: string;
  calibrators: Map<string, IsotonicCalibrator>;
  rollingECE: number;
  consecutiveDriftCycles: number;
  isDemoted: boolean;
  lastDemotionCycle: number;
}

function poolAdjacentViolators(
  predicted: number[],
  observed: number[],
  weights: number[]
): number[] {
  const n = predicted.length;
  const blocks: { start: number; end: number; value: number; weight: number }[] = [];

  for (let i = 0; i < n; i++) {
    blocks.push({
      start: i,
      end: i,
      value: observed[i] ?? 0,
      weight: weights[i] ?? 1,
    });

    while (blocks.length >= 2) {
      const b1 = blocks[blocks.length - 2]!;
      const b2 = blocks[blocks.length - 1]!;
      if (b1.value <= b2.value) break;

      const mergedWeight = b1.weight + b2.weight;
      const mergedValue = (b1.value * b1.weight + b2.value * b2.weight) / mergedWeight;
      blocks[blocks.length - 2] = {
        start: b1.start,
        end: b2.end,
        value: mergedValue,
        weight: mergedWeight,
      };
      blocks.pop();
    }
  }

  const result = new Array<number>(n);
  for (const block of blocks) {
    for (let i = block.start; i <= block.end; i++) {
      result[i] = block.value;
    }
  }
  return result;
}

export function createIsotonicCalibrator(
  version: CalibrationVersion,
  rubric: RubricId | 'classify',
  initialPoints: CalibrationPoint[] = []
): IsotonicCalibrator {
  const points: CalibrationPoint[] = [...initialPoints];
  let isotonicMap: number[] | null = null;
  let sortedPredicted: number[] | null = null;
  let fitted = initialPoints.length > 0 && initialPoints.some((p) => p.observed !== p.predicted);
  /** ECE depends on nothing but `points`, and every reader asks per batch. */
  let cachedECE: number | null = null;

  function rebuild(): void {
    cachedECE = null;
    if (points.length < 2) {
      isotonicMap = null;
      sortedPredicted = null;
      return;
    }

    const sorted = sortBy(points, (p) => p.predicted);
    sortedPredicted = sorted.map((p) => p.predicted);
    const observed = sorted.map((p) => p.observed);
    const weights = sorted.map((p) => p.weight);
    isotonicMap = poolAdjacentViolators(sortedPredicted, observed, weights);
  }

  rebuild();

  return {
    version,
    rubric,
    get fitted(): boolean {
      return fitted;
    },
    calibrate(score: number): number {
      if (!isotonicMap || !sortedPredicted || points.length < 2) {
        return score;
      }

      let idx = sortedPredicted.findIndex((p) => p >= score);
      if (idx === -1) idx = sortedPredicted.length - 1;
      if (idx === 0) return isotonicMap[0] ?? score;
      if (idx >= isotonicMap.length) return isotonicMap[isotonicMap.length - 1] ?? score;

      const p0 = sortedPredicted[idx - 1] ?? 0;
      const p1 = sortedPredicted[idx] ?? 1;
      const v0 = isotonicMap[idx - 1] ?? 0;
      const v1 = isotonicMap[idx] ?? 1;

      if (p1 === p0) return v0;
      return lerp(v0, v1, (score - p0) / (p1 - p0));
    },

    update(newPoints: CalibrationPoint[]): void {
      const hasRealLabels = newPoints.some((p) => p.observed !== p.predicted);
      if (hasRealLabels) {
        fitted = true;
      }
      points.push(...newPoints);
      trimCapped(points, CALIBRATION_POINT_CAP);
      rebuild();
    },

    getECE(): number {
      if (cachedECE === null) {
        cachedECE = weightedAbsoluteError(
          points,
          (p) => this.calibrate(p.predicted) - p.observed,
          (p) => p.weight
        );
      }
      return cachedECE;
    },

    getPoints(): ReadonlyArray<CalibrationPoint> {
      return points;
    },

    reset(): void {
      points.length = 0;
      isotonicMap = null;
      sortedPredicted = null;
      cachedECE = null;
      fitted = false;
    },
  };
}

interface ECESample {
  ece: number;
  sampleCount: number;
}

/**
 * The sample-weighted ECE over a bounded trailing window — drift detection's
 * input. The window is the shared {@link BoundedMap}: one container bounds every
 * cache and ledger hot path in the repository, and a private array plus a
 * hand-rolled prune pass is what it replaces. Expiry is lazy, so a read costs
 * one pass and allocates nothing.
 */
export class RollingECEMonitor {
  #config: RollingECEConfig;
  /** Append-ordered by construction: the key is the record sequence, so the oldest sample leaves first. */
  readonly #samples: BoundedMap<number, ECESample>;
  #seq = 0;

  constructor(config: Partial<RollingECEConfig> = {}) {
    this.#config = {
      windowSize: config.windowSize ?? 100,
      maxSamples: config.maxSamples ?? 1000,
      minSamples: config.minSamples ?? 10,
      driftThreshold: config.driftThreshold ?? 0.15,
    };
    this.#samples = new BoundedMap({
      maxSize: this.#config.maxSamples,
      ttlMs: this.#config.windowSize * 60_000,
    });
  }

  record(ece: number, sampleCount: number): void {
    this.#samples.set(this.#seq++, { ece, sampleCount });
  }

  getRollingECE(): number {
    const { weighted, weight } = this.#aggregate();
    return safeRatio(weighted, weight);
  }

  getSampleCount(): number {
    return this.#aggregate().weight;
  }

  isDriftDetected(): boolean {
    return (
      this.getSampleCount() >= this.#config.minSamples &&
      this.getRollingECE() > this.#config.driftThreshold
    );
  }

  reset(): void {
    this.#samples.clear();
  }

  /** One pass for both readings: a read happens once per batch, twice over. */
  #aggregate(): { weighted: number; weight: number } {
    let weighted = 0;
    let weight = 0;
    for (const { ece, sampleCount } of this.#samples.values()) {
      weighted += (ece ?? 0) * (sampleCount ?? 0);
      weight += sampleCount ?? 0;
    }
    return { weighted, weight };
  }
}

export class DriftDemotionManager {
  #config: DriftDemotionConfig;
  #backendHealth = new Map<string, BackendHealth>();

  constructor(config: Partial<DriftDemotionConfig> = {}) {
    this.#config = {
      eceThreshold: config.eceThreshold ?? 0.15,
      consecutiveCycles: config.consecutiveCycles ?? 3,
      cooldownCycles: config.cooldownCycles ?? 10,
    };
  }

  registerBackend(backendId: string, calibrators: Map<string, IsotonicCalibrator>): void {
    this.#backendHealth.set(backendId, {
      backendId,
      calibrators,
      rollingECE: 0,
      consecutiveDriftCycles: 0,
      isDemoted: false,
      lastDemotionCycle: 0,
    });
  }

  updateCycle(
    backendId: string,
    cycleNumber: number
  ): { demoted: boolean; rollingECE: number } | null {
    const health = this.#backendHealth.get(backendId);
    if (!health) return null;

    const maxECE = maxScore(health.calibrators.values(), (calibrator) => calibrator.getECE());

    health.rollingECE = maxECE;

    if (maxECE > this.#config.eceThreshold) {
      health.consecutiveDriftCycles++;
    } else {
      health.consecutiveDriftCycles = 0;
    }

    if (
      health.consecutiveDriftCycles >= this.#config.consecutiveCycles &&
      !health.isDemoted &&
      cycleNumber - health.lastDemotionCycle >= this.#config.cooldownCycles
    ) {
      health.isDemoted = true;
      health.lastDemotionCycle = cycleNumber;
      return { demoted: true, rollingECE: maxECE };
    }

    return { demoted: false, rollingECE: maxECE };
  }

  getHealth(backendId: string): BackendHealth | undefined {
    return this.#backendHealth.get(backendId);
  }

  getAllHealth(): ReadonlyMap<string, BackendHealth> {
    return this.#backendHealth;
  }

  forceDemote(backendId: string, cycleNumber: number): boolean {
    const health = this.#backendHealth.get(backendId);
    if (!health || health.isDemoted) return false;
    health.isDemoted = true;
    health.lastDemotionCycle = cycleNumber;
    return true;
  }

  canRecover(backendId: string, cycleNumber: number): boolean {
    const health = this.#backendHealth.get(backendId);
    if (!health?.isDemoted) return false;
    return cycleNumber - health.lastDemotionCycle >= this.#config.cooldownCycles;
  }

  attemptRecovery(backendId: string, cycleNumber: number): boolean {
    const health = this.#backendHealth.get(backendId);
    if (!health?.isDemoted) return false;
    if (!this.canRecover(backendId, cycleNumber)) return false;

    const maxECE = maxScore(health.calibrators.values(), (calibrator) => calibrator.getECE());

    if (maxECE <= this.#config.eceThreshold * 0.8) {
      health.isDemoted = false;
      health.consecutiveDriftCycles = 0;
      return true;
    }
    return false;
  }
}

export function createCalibrationSuite(
  version: CalibrationVersion,
  rubrics: (RubricId | 'classify')[]
): Map<string, IsotonicCalibrator> {
  const calibrators = new Map<string, IsotonicCalibrator>();
  for (const rubric of rubrics) {
    calibrators.set(rubric, createIsotonicCalibrator(version, rubric));
  }
  return calibrators;
}

export function createDefaultCalibrationSuite(
  version: CalibrationVersion
): Map<string, IsotonicCalibrator> {
  // One rubric per head, read off the ontology: the hand-written list this replaced
  // named `feasibility` twice and had never heard of `episodic_match`, so a head
  // existed with no calibrator and a rubric had two.
  return createCalibrationSuite(version, [...headRubrics()]);
}
