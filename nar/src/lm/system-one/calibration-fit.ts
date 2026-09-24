import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { createIsotonicCalibrator, type IsotonicCalibrator } from './calibration.js';
import type { JudgmentDataset } from './distill.js';
import type { CalibrationVersion, ModelDigest } from './types.js';
import { DigestMismatchError } from './wasi-runtime.js';

// ─── Lock schema (jevcal pattern: fitted thresholds, digest-pinned) ──────────

export interface CalibrationLockEntry {
  headId: string;
  digest: string;
  abstainThreshold: number;
  ece: number;
  fitted: boolean;
  points: { predicted: number; observed: number; weight: number }[];
}

export interface CalibrationLock {
  version: string;
  generatedAt: number;
  /** Digest of the manifold/head bundle this lock was fitted against. */
  modelDigest?: string;
  heads: CalibrationLockEntry[];
  /** TODO23 Phase 7: metrics over the frozen eval set the fit was scored against. */
  eval?: LockMetrics;
  /** Optional out-of-domain slice metrics (deployment gate for OOD routing). */
  ood?: LockMetrics;
}

export interface LockMetrics {
  brier: number;
  ece: number;
  /** Digest of the frozen eval set (or OOD slice) the metrics were computed over. */
  datasetDigest: string;
  count: number;
}

interface LabeledDatum {
  headId: string;
  predicted: number;
  observed: number;
}

const OBSERVED_BY_LABEL: Record<string, number> = {
  approved: 1,
  rejected: 0,
  support: 1,
  conflict: 0,
  accepted: 1,
  rejected_outcome: 0,
};

/**
 * Extract (predicted, observed) pairs from dataset labels. Rows carry the
 * head's predicted `score` and a ground-truth `observed` (recorded at label
 * time) — the B6 self-supervised no-op never enters this path.
 */
export function extractLabeledData(
  dataset: JudgmentDataset,
  headIds?: readonly string[]
): LabeledDatum[] {
  const wanted = headIds ? new Set(headIds) : null;
  const data: LabeledDatum[] = [];
  for (const label of dataset.all()) {
    if (wanted && !wanted.has(label.rubric)) continue;
    if (label.score === undefined || label.observed === undefined) continue;
    if (!Number.isFinite(label.score) || !Number.isFinite(label.observed)) continue;
    data.push({ headId: label.rubric, predicted: label.score, observed: label.observed });
  }
  return data;
}

function observedFor(label: string): number | undefined {
  if (OBSERVED_BY_LABEL[label] !== undefined) return OBSERVED_BY_LABEL[label];
  const numeric = Number(label);
  return Number.isFinite(numeric) ? numeric : undefined;
}

/** Dataset rows that only carry a categorical label get their observed value derived. */
export function extractLabeledDataWithDerivedOutcomes(
  dataset: JudgmentDataset,
  headIds?: readonly string[]
): LabeledDatum[] {
  const wanted = headIds ? new Set(headIds) : null;
  const data: LabeledDatum[] = [];
  for (const label of dataset.all()) {
    if (wanted && !wanted.has(label.rubric)) continue;
    if (label.score === undefined || !Number.isFinite(label.score)) continue;
    const observed = label.observed ?? observedFor(label.label);
    if (observed === undefined || !Number.isFinite(observed)) continue;
    data.push({ headId: label.rubric, predicted: label.score, observed });
  }
  return data;
}

function split(data: readonly LabeledDatum[], holdoutFraction: number, seed: number) {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shuffled = [...data].sort(() => rand() - 0.5);
  const cut = Math.max(1, Math.floor(shuffled.length * holdoutFraction));
  return { holdout: shuffled.slice(0, cut), fit: shuffled.slice(cut) };
}

/** Identity (unfitted) calibrator ECE — the honest baseline the fit must beat. */
export function identityECE(data: readonly { predicted: number; observed: number }[]): number {
  if (data.length === 0) return 0;
  return data.reduce((sum, d) => sum + Math.abs(d.predicted - d.observed), 0) / data.length;
}

/** Brier with abstain→0.5 fallback, used to select the per-head threshold. */
function brierWithAbstain(
  data: readonly LabeledDatum[],
  calibrate: (s: number) => number,
  threshold: number
): number {
  if (data.length === 0) return 0;
  let sum = 0;
  for (const d of data) {
    const p = d.predicted < threshold ? 0.5 : calibrate(d.predicted);
    sum += (p - d.observed) ** 2;
  }
  return sum / data.length;
}

export interface FitCalibrationOptions {
  headIds?: readonly string[];
  holdoutFraction?: number;
  seed?: number;
  calibrationVersion?: CalibrationVersion;
  /** Refit points per head; heads with fewer usable rows stay unfitted. */
  minRows?: number;
  /** TODO23 Phase 7: frozen eval set — its metrics land in `lock.eval`. */
  frozenSet?: { digest: string; rows: readonly { predicted: number; observed: number }[] };
  /** Out-of-domain slice of the frozen set — its metrics land in `lock.ood`. */
  oodSet?: { digest: string; rows: readonly { predicted: number; observed: number }[] };
}

export interface FitCalibrationResult {
  lock: CalibrationLock;
  perHead: Map<string, IsotonicCalibrator>;
  /** True when every requested head produced an ECE improvement over identity on holdout. */
  improved: boolean;
}

const THRESHOLD_GRID = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5];

export function fitCalibrationLock(
  dataset: JudgmentDataset,
  options: FitCalibrationOptions = {}
): FitCalibrationResult {
  const holdoutFraction = options.holdoutFraction ?? 0.3;
  const minRows = options.minRows ?? 8;
  const version = (options.calibrationVersion ?? 'v2.4.1') as CalibrationVersion;

  const data = extractLabeledDataWithDerivedOutcomes(dataset, options.headIds);
  const byHead = new Map<string, LabeledDatum[]>();
  for (const d of data) {
    const list = byHead.get(d.headId) ?? [];
    list.push(d);
    byHead.set(d.headId, list);
  }

  const perHead = new Map<string, IsotonicCalibrator>();
  const entries: CalibrationLockEntry[] = [];
  let improved = true;

  for (const [headId, headData] of byHead) {
    if (headData.length < minRows) {
      improved = false;
      continue;
    }
    const { fit, holdout } = split(headData, holdoutFraction, options.seed ?? 7);
    const calibrator = createIsotonicCalibrator(version, headId as never);
    calibrator.update(
      fit.map((d) => ({ predicted: d.predicted, observed: d.observed, weight: 1 }))
    );

    const fittedECE = identityECE(
      holdout.map((d) => ({ ...d, predicted: calibrator.calibrate(d.predicted) }))
    );
    const baselineECE = identityECE(holdout);
    if (fittedECE >= baselineECE) improved = false;

    const threshold = THRESHOLD_GRID.reduce(
      (best, t) => {
        const loss = brierWithAbstain(holdout, (s) => calibrator.calibrate(s), t);
        return loss < best.loss ? { t, loss } : best;
      },
      { t: 0, loss: Infinity }
    ).t;

    perHead.set(headId, calibrator);
    entries.push({
      headId,
      digest: `sha256:${createLockDigest(calibrator, threshold)}`,
      abstainThreshold: threshold,
      ece: fittedECE,
      fitted: calibrator.fitted,
      points: calibrator
        .getPoints()
        .map((p) => ({ predicted: p.predicted, observed: p.observed, weight: p.weight })),
    });
  }

  return {
    lock: {
      version,
      generatedAt: Date.now(),
      heads: entries,
      ...(options.frozenSet && options.frozenSet.rows.length > 0
        ? { eval: lockMetrics(options.frozenSet) }
        : {}),
      ...(options.oodSet && options.oodSet.rows.length > 0
        ? { ood: lockMetrics(options.oodSet) }
        : {}),
    },
    perHead,
    improved,
  };
}

function lockMetrics(set: {
  digest: string;
  rows: readonly { predicted: number; observed: number }[];
}): LockMetrics {
  const brier = set.rows.reduce((s, r) => s + (r.predicted - r.observed) ** 2, 0) / set.rows.length;
  return { brier, ece: identityECE(set.rows), datasetDigest: set.digest, count: set.rows.length };
}

function createLockDigest(calibrator: IsotonicCalibrator, threshold: number): string {
  // Lightweight content digest over the sorted calibration curve + threshold.
  const hash = createHash('sha256');
  for (const p of [...calibrator.getPoints()].sort((a, b) => a.predicted - b.predicted)) {
    hash.update(`${p.predicted}:${p.observed}:${p.weight};`);
  }
  hash.update(`threshold=${threshold}`);
  return hash.digest('hex');
}

export async function writeCalibrationLock(lock: CalibrationLock, path: string): Promise<void> {
  const { dirname } = await import('node:path');
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(lock, null, 2));
}

export async function readCalibrationLock(path: string): Promise<CalibrationLock> {
  return JSON.parse(await fs.readFile(path, 'utf-8')) as CalibrationLock;
}

/**
 * Digest-pinned lock load (H3 fail-closed semantics): a lock pinned to a
 * modelDigest that does not match the manifold's bundle is rejected outright.
 */
export function assertLockMatches(lock: CalibrationLock, modelDigest: ModelDigest): void {
  if (lock.modelDigest && lock.modelDigest !== modelDigest) {
    throw new DigestMismatchError(modelDigest, lock.modelDigest);
  }
}

/** Apply a verified lock to a calibrator suite (fitted points flow in, B6 no-op replaced). */
export function applyCalibrationLock(
  calibrators: Map<string, IsotonicCalibrator>,
  lock: CalibrationLock
): void {
  for (const entry of lock.heads) {
    const calibrator = calibrators.get(entry.headId);
    if (!calibrator) continue;
    calibrator.reset();
    calibrator.update(entry.points);
  }
}
