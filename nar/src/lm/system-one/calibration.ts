import type { CalibrationVersion, JudgmentProposition, RubricId } from './types.js';

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
  windowSize: number;
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

function poolAdjacentViolators(predicted: number[], observed: number[], weights: number[]): number[] {
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
  let fitted = initialPoints.length > 0 && initialPoints.some(p => p.observed !== p.predicted);

  function rebuild(): void {
    if (points.length < 2) {
      isotonicMap = null;
      sortedPredicted = null;
      return;
    }

    const sorted = [...points].sort((a, b) => a.predicted - b.predicted);
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
      const t = (score - p0) / (p1 - p0);
      return v0 + t * (v1 - v0);
    },

    update(newPoints: CalibrationPoint[]): void {
      const hasRealLabels = newPoints.some(p => p.observed !== p.predicted);
      if (hasRealLabels) {
        fitted = true;
      }
      points.push(...newPoints);
      if (points.length > 10000) {
        points.splice(0, points.length - 10000);
      }
      rebuild();
    },

    getECE(): number {
      if (points.length === 0) return 0;
      let ece = 0;
      let totalWeight = 0;
      for (const p of points) {
        const calibrated = this.calibrate(p.predicted);
        ece += Math.abs(calibrated - p.observed) * p.weight;
        totalWeight += p.weight;
      }
      return totalWeight > 0 ? ece / totalWeight : 0;
    },

    getPoints(): ReadonlyArray<CalibrationPoint> {
      return points;
    },

    reset(): void {
      points.length = 0;
      isotonicMap = null;
      sortedPredicted = null;
      fitted = false;
    },
  };
}

export class RollingECEMonitor {
  #config: RollingECEConfig;
  #samples: { ece: number; timestamp: number; sampleCount: number }[] = [];

  constructor(config: Partial<RollingECEConfig> = {}) {
    this.#config = {
      windowSize: config.windowSize ?? 100,
      minSamples: config.minSamples ?? 10,
      driftThreshold: config.driftThreshold ?? 0.15,
    };
  }

  record(ece: number, sampleCount: number): void {
    const now = Date.now();
    this.#samples.push({ ece, timestamp: now, sampleCount });
    this.#prune(now);
  }

  getRollingECE(): number {
    this.#prune(Date.now());
    if (this.#samples.length === 0) return 0;
    const totalWeight = this.#samples.reduce((sum, s) => sum + (s.sampleCount ?? 0), 0);
    if (totalWeight === 0) return 0;
    return this.#samples.reduce((sum, s) => sum + (s.ece ?? 0) * (s.sampleCount ?? 0), 0) / totalWeight;
  }

  getSampleCount(): number {
    this.#prune(Date.now());
    return this.#samples.reduce((sum, s) => sum + (s.sampleCount ?? 0), 0);
  }

  isDriftDetected(): boolean {
    return this.getSampleCount() >= this.#config.minSamples && this.getRollingECE() > this.#config.driftThreshold;
  }

  reset(): void {
    this.#samples.length = 0;
  }

  #prune(now: number): void {
    const cutoff = now - this.#config.windowSize * 60_000;
    this.#samples = this.#samples.filter((s) => s.timestamp > cutoff);
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

  updateCycle(backendId: string, cycleNumber: number): { demoted: boolean; rollingECE: number } | null {
    const health = this.#backendHealth.get(backendId);
    if (!health) return null;

    let maxECE = 0;
    for (const calibrator of health.calibrators.values()) {
      const ece = calibrator.getECE();
      if (ece > maxECE) maxECE = ece;
    }

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
    if (!health || !health.isDemoted) return false;
    return cycleNumber - health.lastDemotionCycle >= this.#config.cooldownCycles;
  }

  attemptRecovery(backendId: string, cycleNumber: number): boolean {
    const health = this.#backendHealth.get(backendId);
    if (!health || !health.isDemoted) return false;
    if (!this.canRecover(backendId, cycleNumber)) return false;

    let maxECE = 0;
    for (const calibrator of health.calibrators.values()) {
      const ece = calibrator.getECE();
      if (ece > maxECE) maxECE = ece;
    }

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

const INGRESS_RUBRICS: (RubricId | 'classify')[] = [
  'task_type',
  'illocution',
  'injection',
  'ambiguity',
  'tense',
  'source_quality',
];

const SYNTHESIS_RUBRICS: (RubricId | 'classify')[] = [
  'candidate_select',
  'conflict',
  'groundedness',
];

const ACTION_RUBRICS: (RubricId | 'classify')[] = [
  'tool_dispatch',
  'risk',
  'feasibility',
  'strategy',
  'reflex_value',
];

export const ALL_RUBRICS: (RubricId | 'classify')[] = [
  ...INGRESS_RUBRICS,
  ...SYNTHESIS_RUBRICS,
  ...ACTION_RUBRICS,
  'relevance',
  'novelty',
  'plausibility',
  'assertion',
  'feasibility',
];

export function createDefaultCalibrationSuite(version: CalibrationVersion): Map<string, IsotonicCalibrator> {
  return createCalibrationSuite(version, ALL_RUBRICS);
}