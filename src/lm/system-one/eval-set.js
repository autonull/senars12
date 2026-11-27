/**
 * Frozen evaluation set (TODO23 Phase 2): a digest-pinned label snapshot
 * written once and read-only at train time, so teacher-error data cannot
 * migrate into training across distillation generations. Conversation-captured
 * rows (TODO22 auto-capture) are excluded by construction.
 */
import { promises as fs } from 'node:fs';
import { groupBy, mapToRecord } from '@senars/util/collections';
import { writeJsonFile } from '@senars/util/fs';
import { sha256Prefixed } from '@senars/util/hash';
import { SenarsError } from '@senars/errors';
import { identityECE, meanBrier } from './calibration-fit';
import { frozenRegression } from './metrics';
import { DigestMismatchError } from './wasi-runtime';
/** TODO22 auto-capture source — never eligible for the frozen set. */
export const CONVERSATION_SOURCE = 'conversation';
/** TODO24 dialogue-reaction source — never eligible for the frozen set (I1). */
export const REACTION_SOURCE = 'reaction';
export class EvalRegressionError extends SenarsError {
    baseline;
    candidate;
    tolerance;
    constructor(reason, baseline, candidate, tolerance) {
        super(reason, 'VALIDATION_ERROR', { baseline, candidate, tolerance });
        this.baseline = baseline;
        this.candidate = candidate;
        this.tolerance = tolerance;
        this.name = 'EvalRegressionError';
    }
}
export function digestRows(rows) {
    const canonical = rows
        .map((r) => `${r.headId}|${r.predicted.toFixed(6)}|${r.observed.toFixed(6)}`)
        .sort()
        .join('\n');
    return sha256Prefixed(canonical);
}
/**
 * Freeze (predicted, observed) pairs from the distillation dataset.
 * `conversation`-sourced rows are excluded by construction (default), so
 * auto-captured graded turns can never re-enter evaluation.
 */
export function createFrozenEvalSet(dataset, options = {}) {
    const excluded = new Set(options.excludeSources ?? [CONVERSATION_SOURCE, REACTION_SOURCE]);
    const rows = dataset
        .all()
        .filter((l) => !excluded.has(l.source))
        .filter((l) => l.score !== undefined && l.observed !== undefined)
        .filter((l) => Number.isFinite(l.score) && Number.isFinite(l.observed))
        .map((l) => ({
        headId: l.rubric,
        predicted: l.score,
        observed: l.observed,
        ...(l.domain ? { domain: l.domain } : {}),
    }));
    return {
        version: 'eval-set-v1',
        createdAt: Date.now(),
        sourceDigest: digestRows(rows),
        digest: digestRows(rows),
        rows,
    };
}
/** Split a frozen set into in-domain and OOD slices (Phase 7 lock metrics). */
export function splitOod(rows) {
    const inDomain = [];
    const ood = [];
    for (const row of rows)
        (row.domain === 'ood' ? ood : inDomain).push(row);
    return { inDomain, ood };
}
/** Brier + ECE over the frozen rows (per-row; head-level breakdown via `headMetrics`). */
export function evalMetrics(rows) {
    if (rows.length === 0)
        return { brier: 0, ece: 0, count: 0 };
    const brier = meanBrier(rows);
    return { brier, ece: identityECE(rows), count: rows.length };
}
export function headMetrics(rows) {
    return mapToRecord(groupBy(rows, (row) => row.headId), evalMetrics);
}
export async function writeEvalSet(set, path) {
    await writeJsonFile(path, set);
}
/** Fail-closed: a digest mismatch (corrupted or tampered snapshot) throws. */
export async function loadEvalSet(path) {
    const set = JSON.parse(await fs.readFile(path, 'utf-8'));
    if (digestRows(set.rows) !== set.digest) {
        throw new DigestMismatchError(`sha256:<frozen>`, `corrupt: ${path}`);
    }
    return set;
}
/**
 * Promotion gate (Phase 2): a candidate head must not regress on the frozen
 * set beyond `tolerance`. Compares Brier — lower is better.
 */
export function assertFrozenNonRegression(baseline, candidate, tolerance = 0.02) {
    const verdict = frozenRegression(baseline.brier, candidate.brier, tolerance);
    if (verdict.regressed) {
        throw new EvalRegressionError(verdict.reason, baseline.brier, candidate.brier, tolerance);
    }
}
