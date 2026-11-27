import { appendJsonlAsync, iterateJsonl, jsonlPayload, writeJsonl } from '@senars/util/fs';
import { lastByKey } from '@senars/util/collections';
import { makeId } from '@senars/util/id';
import { periodic } from '@senars/util/async';
import { createLedger, BaseLedgerEntrySchema } from '@senars/util/ledger';
import { SHA256_PINNED, sha256HexParts } from '@senars/util/hash';
import { z } from 'zod';
import { Truth } from '../../terms/impls/Truth';
import { frozenRegression, meanBrierOf } from './metrics';
import { seedTruth } from './seed';
/** Input-anchored evidence identity: same utterance ⇒ same evidence, regardless of re-judging. */
export const computeEvidenceId = (utteranceId, sourceSpan) => sha256HexParts([utteranceId, sourceSpan]);
/**
 * Promotion of a provisional hypothesis by a later judgment pass.
 * Evidence-weighted revision caps at MAX_CONFIDENCE — re-judging the same
 * evidence never inflates confidence beyond the NAL revision bound.
 */
export function promoteProvisional(current, incoming) {
    const incomingTruth = seedTruth(incoming);
    return current ? Truth.revision(current, incomingTruth) : incomingTruth;
}
/** Vector encoded as base64 for inline storage in JSONL. */
function encodeVector(vec) {
    return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength).toString('base64');
}
export function decodeVector(b64) {
    const buf = Buffer.from(b64, 'base64');
    return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}
/** Ledger entry schema for distillation labels with inline vectors. */
const DistillationLabelEntrySchema = BaseLedgerEntrySchema.extend({
    evidenceId: z.string(),
    rubric: z.string(),
    axis: z.string(),
    label: z.string(),
    score: z.number().optional(),
    observed: z.number().optional(),
    vector: z.string().optional(),
    source: z.string(),
    cortexModelId: z.string().optional(),
    domain: z.enum(['in-domain', 'ood']).optional(),
});
/** How many labels the synchronous view keeps for a calibration fit. */
const JUDGMENT_DATASET_WINDOW = 50_000;
/** A label with its sidecar vector encoded into the row, if one is held. */
const withInlineVector = (vectors) => (label) => {
    const vector = vectors.get(label.evidenceId);
    return vector ? { ...label, vector: encodeVector(vector) } : label;
};
/** Append-only, redaction-per-retention: hashes + labels + inline vectors, never raw text. */
export class JudgmentDataset {
    #ledger;
    /**
     * Decoded sidecar vectors, one per label.
     *
     * Bounded by the ledger's mirror, not by a second window: the mirror's
     * `onEvict` drops the vector for a row the window has shed. Ten writers reach
     * `record` — per tool call from the trace grader, per tick from the reflex
     * label source — and a 384-d `Float32Array` is ~1.5 KB, so a plain map was
     * fifteen megabytes that never came back.
     */
    #vectors = new Map();
    /** Mirror sequence already handed to an export file; see {@link flush}. */
    #exportedSeq = 0;
    constructor(basePath, options = {}) {
        this.#ledger = createLedger(basePath, DistillationLabelEntrySchema, {
            rollover: options.rollover,
            hotRetentionMs: 5 * 60 * 1000,
            mirror: {
                maxSize: JUDGMENT_DATASET_WINDOW,
                onEvict: (row) => {
                    this.#vectors.delete(row.evidenceId);
                },
            },
        });
    }
    /** Record a label with optional inline vector (base64-encoded). */
    record(label, embedding) {
        const vectorB64 = embedding ? encodeVector(embedding) : label.vector;
        this.#ledger.append(vectorB64 ? { ...label, vector: vectorB64 } : label);
        if (embedding)
            this.#vectors.set(label.evidenceId, embedding);
    }
    /** Get the vector for a given evidenceId (synchronous, from in-memory index). */
    getVector(evidenceId) {
        return this.#vectors.get(evidenceId);
    }
    /** Get all labels (synchronous, from the ledger's mirror). */
    all() {
        return this.#ledger.records();
    }
    get size() {
        return this.#ledger.size;
    }
    /** Labels with their sidecar vectors inlined, as JSON-ready rows. */
    rows() {
        return this.#ledger.records().map(withInlineVector(this.#vectors));
    }
    /**
     * Rows as newline-joined JSON — one payload a caller can hand to `JSON.parse`,
     * so the on-disk trailing newline that {@link jsonlPayload} appends is dropped
     * here. Flushing keeps it; serialization does not.
     */
    toJSONL() {
        return jsonlPayload(this.rows()).replace(/\n$/, '');
    }
    /**
     * Append the labels recorded since the last flush to a JSONL file.
     *
     * Incremental because the caller is a timer: the export mirrors the dataset,
     * and re-appending the whole window every interval wrote the same rows over
     * and over while serializing fifty thousand of them each time. A `load()`
     * -then-`flush()` pair resets the cursor, so a round trip still exports every
     * label exactly once.
     */
    async flush(path) {
        const { entries, seq } = this.#ledger.recordsSince(this.#exportedSeq);
        if (entries.length === 0)
            return;
        await appendJsonlAsync(path, entries.map(withInlineVector(this.#vectors)));
        this.#exportedSeq = seq;
    }
    /** Load a JSONL file and replace the current dataset. */
    static async load(path, basePath) {
        const dataset = new JudgmentDataset(basePath ?? (path.replace(/\/[^/]+$/, '') || '.'));
        for await (const label of iterateJsonl(path, (v) => v)) {
            if (!label)
                continue;
            dataset.record(label);
            if (label.vector)
                dataset.#vectors.set(label.evidenceId, decodeVector(label.vector));
        }
        return dataset;
    }
    /**
     * Compaction for the append-only dataset — dedupe rows by evidenceId (last wins).
     * Returns `{kept, dropped}`.
     */
    static async compact(datasetPath) {
        const rows = [];
        let read = 0;
        for await (const label of iterateJsonl(datasetPath, (v) => v)) {
            read++;
            if (label)
                rows.push(label);
        }
        const byId = lastByKey(rows, (label) => label.evidenceId);
        await writeJsonl(datasetPath, [...byId.values()]);
        return { kept: byId.size, dropped: read - byId.size };
    }
    /**
     * Periodic append of recorded labels to `path` (auto-flush).
     *
     * The returned stop cancels the timer *and* resolves once the flush it already
     * started has landed. Cancelling the timer alone left that write in flight, so
     * a caller that stopped and immediately read the file back — the round trip
     * `load()`-then-`flush()` exists to support — raced it.
     */
    startAutoFlush(path, intervalMs = 30_000) {
        let inFlight = Promise.resolve();
        const stopTimer = periodic(() => {
            inFlight = this.flush(path).catch(() => {
                // Auto-flush is best-effort; the next tick retries.
            });
        }, intervalMs);
        return async () => {
            stopTimer();
            await inFlight;
        };
    }
    /** Close the ledger (stop timers, flush). */
    close() {
        this.#ledger.close();
    }
}
/** Bench 10: promoted head matches incumbent accuracy on shadow bake-off within 2%. */
export function runBakeOff(_incumbent, _candidate, cases, parityTolerance = 0.02, _eceBound = 0.1, 
/** Governance option: accept strictly-better candidates beyond the tolerance window (reject only regressions). */
acceptImprovements = false, 
/** TODO23 Phase 2: frozen eval-set cases — promotion requires non-regression here. */
frozen) {
    const brier = (key) => meanBrierOf(cases, (c) => c[key], (c) => c.truth);
    const incumbentAccuracy = 1 - brier('incumbent');
    const candidateAccuracy = 1 - brier('candidate');
    const parityGap = Math.abs(candidateAccuracy - incumbentAccuracy);
    const withinParity = parityGap <= parityTolerance;
    // Frozen-set non-regression gate: the candidate may never score worse than
    // the incumbent on the digest-pinned snapshot beyond the tolerance window.
    let frozenReport;
    if (frozen && frozen.cases.length > 0) {
        const brierOf = (key) => meanBrierOf(frozen.cases, (c) => c[key], (c) => c.truth);
        const baselineBrier = brierOf('incumbent');
        const candidateBrier = brierOf('candidate');
        const tolerance = frozen.tolerance ?? parityTolerance;
        const verdict = frozenRegression(baselineBrier, candidateBrier, tolerance);
        frozenReport = { baselineBrier, candidateBrier, nonRegression: !verdict.regressed };
        if (verdict.regressed) {
            return {
                incumbentAccuracy,
                candidateAccuracy,
                parityGap,
                withinParity,
                accepted: false,
                reason: verdict.reason,
                frozen: frozenReport,
            };
        }
    }
    if (!withinParity && !(acceptImprovements && candidateAccuracy > incumbentAccuracy)) {
        return {
            incumbentAccuracy,
            candidateAccuracy,
            parityGap,
            withinParity,
            accepted: false,
            reason: `Parity gap ${parityGap.toFixed(4)} exceeds tolerance ${parityTolerance}`,
            frozen: frozenReport,
        };
    }
    return {
        incumbentAccuracy,
        candidateAccuracy,
        parityGap,
        withinParity,
        accepted: true,
        reason: `Parity gap ${parityGap.toFixed(4)} within tolerance; candidate accuracy ${candidateAccuracy.toFixed(4)}`,
        frozen: frozenReport,
    };
}
/**
 * Bench 14: sabotage gate. Rejects and flags:
 * - un-pinned model digest (supply-chain compromise)
 * - relaxed abstain threshold τ (safety-floor erosion)
 * - disabled injection head (fail-closed removal)
 */
export function validateHeadCandidate(candidate, incumbent) {
    const violations = [];
    if (!SHA256_PINNED.test(candidate.modelDigest)) {
        violations.push(`Un-pinned modelDigest '${candidate.modelDigest}' — head must be hash-pinned (SHA256(weights))`);
    }
    if (incumbent && candidate.abstainThreshold < incumbent.abstainThreshold) {
        violations.push(`Relaxed abstainThreshold ${candidate.abstainThreshold} < incumbent ${incumbent.abstainThreshold} — monotonic safety forbids`);
    }
    if (candidate.headId === 'injection' && !candidate.enabled) {
        violations.push('Disabled injection head — fail-closed safety floor cannot be removed');
    }
    return { accepted: violations.length === 0, violations };
}
// ─── Governed promotion (§9.2 — reuse the governance pipeline verbatim) ──────
/** Head swap = MEDIUM risk; SandboxValidator has no automated checks → held for review. */
export function buildHeadSwapProposal(candidate, bakeOff) {
    return {
        proposalId: makeId(),
        kind: 'patch-apply',
        riskTier: 'medium',
        payload: {
            operation: 'head-swap',
            headId: candidate.headId,
            modelDigest: candidate.modelDigest,
            calibrationVersion: candidate.calibrationVersion,
            abstainThreshold: candidate.abstainThreshold,
            bakeOff: {
                candidateAccuracy: bakeOff.candidateAccuracy,
                incumbentAccuracy: bakeOff.incumbentAccuracy,
                parityGap: bakeOff.parityGap,
            },
        },
        rewardDomain: 'self-config-proposal',
        correlationId: `head-swap:${candidate.headId}`,
    };
}
/** Sabotage attempt → HIGH risk proposal so the router can never auto-apply it. */
export function buildSabotageFlag(candidate, violations) {
    return {
        proposalId: makeId(),
        kind: 'patch-apply',
        riskTier: 'high',
        payload: {
            operation: 'sabotage-flagged',
            headId: candidate.headId,
            modelDigest: candidate.modelDigest,
            violations: [...violations],
        },
        rewardDomain: 'self-config-proposal',
        correlationId: `sabotage:${candidate.headId}`,
    };
}
