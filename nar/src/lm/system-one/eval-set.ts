/**
 * Frozen evaluation set (TODO23 Phase 2): a digest-pinned label snapshot
 * written once and read-only at train time, so teacher-error data cannot
 * migrate into training across distillation generations. Conversation-captured
 * rows (TODO22 auto-capture) are excluded by construction.
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { identityECE } from './calibration-fit.js';
import { DigestMismatchError } from './wasi-runtime.js';
import type { JudgmentDataset } from './distill.js';

/** TODO22 auto-capture source — never eligible for the frozen set. */
export const CONVERSATION_SOURCE = 'conversation';

export interface FrozenEvalRow {
  headId: string;
  predicted: number;
  observed: number;
}

export interface FrozenEvalSet {
  version: 'eval-set-v1';
  createdAt: number;
  /** Digest of the source dataset rows at freeze time. */
  sourceDigest: string;
  /** Digest pin over the frozen rows; verified fail-closed on every load. */
  digest: string;
  rows: readonly FrozenEvalRow[];
}

export interface EvalMetrics {
  brier: number;
  ece: number;
  count: number;
}

export class EvalRegressionError extends Error {
  constructor(baseline: number, candidate: number, tolerance: number) {
    super(
      `Frozen-set regression: Brier ${candidate.toFixed(4)} > baseline ${baseline.toFixed(4)} + tolerance ${tolerance}`
    );
    this.name = 'EvalRegressionError';
  }
}

export function digestRows(rows: readonly FrozenEvalRow[]): string {
  const canonical = rows
    .map((r) => `${r.headId}|${r.predicted.toFixed(6)}|${r.observed.toFixed(6)}`)
    .sort()
    .join('\n');
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

/**
 * Freeze (predicted, observed) pairs from the distillation dataset.
 * `conversation`-sourced rows are excluded by construction (default), so
 * auto-captured graded turns can never re-enter evaluation.
 */
export function createFrozenEvalSet(
  dataset: JudgmentDataset,
  options: { excludeSources?: readonly string[] } = {}
): FrozenEvalSet {
  const excluded = new Set(options.excludeSources ?? [CONVERSATION_SOURCE]);
  const rows: FrozenEvalRow[] = dataset
    .all()
    .filter((l) => !excluded.has(l.source))
    .filter((l) => l.score !== undefined && l.observed !== undefined)
    .filter((l) => Number.isFinite(l.score!) && Number.isFinite(l.observed!))
    .map((l) => ({ headId: l.rubric, predicted: l.score!, observed: l.observed! }));
  return {
    version: 'eval-set-v1',
    createdAt: Date.now(),
    sourceDigest: digestRows(rows),
    digest: digestRows(rows),
    rows,
  };
}

/** Brier + ECE over the frozen rows (per-row; head-level breakdown via `headMetrics`). */
export function evalMetrics(rows: readonly FrozenEvalRow[]): EvalMetrics {
  if (rows.length === 0) return { brier: 0, ece: 0, count: 0 };
  const brier = rows.reduce((s, r) => s + (r.predicted - r.observed) ** 2, 0) / rows.length;
  return { brier, ece: identityECE(rows), count: rows.length };
}

export function headMetrics(
  rows: readonly FrozenEvalRow[]
): Record<string, EvalMetrics> {
  const byHead = new Map<string, FrozenEvalRow[]>();
  for (const row of rows) {
    const bucket = byHead.get(row.headId) ?? [];
    bucket.push(row);
    byHead.set(row.headId, bucket);
  }
  return Object.fromEntries([...byHead.entries()].map(([headId, r]) => [headId, evalMetrics(r)]));
}

export async function writeEvalSet(set: FrozenEvalSet, path: string): Promise<void> {
  const { promises: fs } = await import('node:fs');
  const { dirname } = await import('node:path');
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(set, null, 2), 'utf-8');
}

/** Fail-closed: a digest mismatch (corrupted or tampered snapshot) throws. */
export async function loadEvalSet(path: string): Promise<FrozenEvalSet> {
  const set = JSON.parse(await fs.readFile(path, 'utf-8')) as FrozenEvalSet;
  if (digestRows(set.rows) !== set.digest) {
    throw new DigestMismatchError(`sha256:<frozen>`, `corrupt: ${path}`);
  }
  return set;
}

/**
 * Promotion gate (Phase 2): a candidate head must not regress on the frozen
 * set beyond `tolerance`. Compares Brier — lower is better.
 */
export function assertFrozenNonRegression(
  baseline: EvalMetrics,
  candidate: EvalMetrics,
  tolerance = 0.02
): void {
  if (candidate.brier > baseline.brier + tolerance) {
    throw new EvalRegressionError(baseline.brier, candidate.brier, tolerance);
  }
}
