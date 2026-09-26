import { createHash } from 'node:crypto';
import type { SelfImprovementProposal } from '@senars/kernel/schemas';
import { v4 as uuidv4 } from 'uuid';
import { Truth, type Truth as TruthType } from '../../terms/truth.js';
import { seedTruth } from './seed.js';
import type { JudgmentProposition } from './types.js';
import { Ledger, createLedger, BaseLedgerEntrySchema, type LedgerQuery } from '@senars/io';
import { z } from 'zod';

/** Input-anchored evidence identity: same utterance ⇒ same evidence, regardless of re-judging. */
export function computeEvidenceId(utteranceId: string, sourceSpan: string): string {
  return createHash('sha256').update(`${utteranceId}::${sourceSpan}`).digest('hex');
}

/**
 * Promotion of a provisional hypothesis by a later judgment pass.
 * Evidence-weighted revision caps at MAX_CONFIDENCE — re-judging the same
 * evidence never inflates confidence beyond the NAL revision bound.
 */
export function promoteProvisional(
  current: TruthType | undefined,
  incoming: JudgmentProposition
): TruthType {
  const incomingTruth = seedTruth(incoming);
  return current ? Truth.revision(current, incomingTruth) : incomingTruth;
}

/** Vector encoded as base64 for inline storage in JSONL. */
function encodeVector(vec: Float32Array): string {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength).toString('base64');
}

function decodeVector(b64: string): Float32Array {
  const buf = Buffer.from(b64, 'base64');
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

export interface DistillationLabel {
  evidenceId: string;
  rubric: string;
  axis: string;
  label: string;
  score?: number;
  /** Ground-truth outcome recorded at label time (D2 calibration input). */
  observed?: number;
  /** Inline vector data (base64-encoded 384-d Float32Array). Replaces vecRef sidecar. */
  vector?: string;
  source: string;
  /** H5/X18: which Cortex model produced the candidates this label judged. */
  cortexModelId?: string;
  /** TODO23: domain marker — 'ood' rows form the frozen-set OOD slice. */
  domain?: 'in-domain' | 'ood';
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

export type DistillationLabelEntry = z.infer<typeof DistillationLabelEntrySchema>;

/** Append-only, redaction-per-retention: hashes + labels + inline vectors, never raw text. */
export class JudgmentDataset {
  readonly #ledger: Ledger<DistillationLabelEntry>;
  readonly #basePath: string;
  #labels: DistillationLabel[] = [];
  #vectors = new Map<string, Float32Array>();

  constructor(basePath: string, options: { rollover?: any } = {}) {
    this.#basePath = basePath;
    this.#ledger = createLedger<DistillationLabelEntry>(basePath, DistillationLabelEntrySchema, {
      rollover: options.rollover ?? { daily: true, maxEntriesPerFile: 10_000, retentionDays: 30 },
      hotRetentionMs: 5 * 60 * 1000,
    });
  }

  /** Record a label with optional inline vector (base64-encoded). */
  record(label: DistillationLabel, embedding?: Float32Array): void {
    this.#labels.push(label);
    if (embedding) this.#vectors.set(label.evidenceId, embedding);
    const entry: DistillationLabelEntry = {
      ...label,
      at: Date.now(),
      vector: embedding ? encodeVector(embedding) : label.vector,
    };
    this.#ledger.append(entry);
  }

  /** Record a raw state embedding keyed by evidenceId (inline vector storage). */
  recordVector(evidenceId: string, embedding: Float32Array): void {
    this.#vectors.set(evidenceId, embedding);
  }

  /** Get the vector for a given evidenceId (synchronous, from in-memory index). */
  getVector(evidenceId: string): Float32Array | undefined {
    return this.#vectors.get(evidenceId);
  }

  /** Get all labels (synchronous, from in-memory index). */
  all(): readonly DistillationLabel[] {
    return this.#labels;
  }

  get size(): number {
    return this.#labels.length;
  }

  toJSONL(): string {
    return this.#labels.map((l) => JSON.stringify(l)).join('\n');
  }

  /** Append the dataset to a JSONL file (creates directory if needed). */
  async flush(path: string): Promise<void> {
    const { promises: fs } = await import('node:fs');
    const { dirname } = await import('node:path');
    await fs.mkdir(dirname(path), { recursive: true });
    const jsonl = this.toJSONL();
    if (jsonl) {
      await fs.appendFile(path, `${jsonl}\n`, 'utf-8');
    }
  }

  /** Load a JSONL file and replace the current dataset. */
  static async load(path: string, basePath?: string): Promise<JudgmentDataset> {
    const { promises: fs } = await import('node:fs');
    const datasetBasePath = basePath ?? (path.replace(/\/[^/]+$/, '') || '.');
    const dataset = new JudgmentDataset(datasetBasePath);
    try {
      const content = await fs.readFile(path, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const label = JSON.parse(line) as DistillationLabel;
          dataset.record(label);
          // If vector is present in the label, decode and store it
          if (label.vector) {
            const buf = Buffer.from(label.vector, 'base64');
            dataset.#vectors.set(label.evidenceId, new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4));
          }
        } catch {
          // Skip malformed lines
        }
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') throw e;
    }
    return dataset;
  }

  /**
   * Compaction for the append-only dataset — dedupe rows by evidenceId (last wins).
   * Returns `{kept, dropped}`.
   */
  static async compact(datasetPath: string): Promise<{ kept: number; dropped: number }> {
    const { promises: fs } = await import('node:fs');
    const { dirname } = await import('node:path');
    const content = await fs.readFile(datasetPath, 'utf-8');
    const byId = new Map<string, DistillationLabel>();
    let dropped = 0;
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const label = JSON.parse(line) as DistillationLabel;
        if (byId.has(label.evidenceId)) dropped++;
        byId.set(label.evidenceId, label);
      } catch {
        dropped++;
      }
    }
    await fs.mkdir(dirname(datasetPath), { recursive: true });
    await fs.writeFile(
      datasetPath,
      `${[...byId.values()].map((l) => JSON.stringify(l)).join('\n')}\n`,
      'utf-8'
    );
    return { kept: byId.size, dropped };
  }

  /** Periodic append of recorded labels to `path` (auto-flush). Returns a stop function. */
  startAutoFlush(path: string, intervalMs = 30_000): () => void {
    const timer = setInterval(() => {
      void this.flush(path).catch(() => {
        // Auto-flush is best-effort; the next tick retries.
      });
    }, intervalMs);
    timer.unref?.();
    return () => clearInterval(timer);
  }

  /** Close the ledger (stop timers, flush). */
  close(): void {
    this.#ledger.close();
  }
}

// ─── Bake-off & governed promotion (§9.2) ───────────────────────────────────

export interface HeadCandidateSpec {
  headId: string;
  modelDigest: string;
  calibrationVersion: string;
  abstainThreshold: number;
  enabled: boolean;
}

export interface BakeOffCase {
  /** Ground truth, 0..1 */
  truth: number;
  /** Incumbent head predicted score, 0..1 */
  incumbent: number;
  /** Candidate head predicted score, 0..1 */
  candidate: number;
}

export interface BakeOffResult {
  /** H5/X18: model id recorded on bake-off artifacts for label provenance. */
  cortexModelId?: string;
  incumbentAccuracy: number;
  candidateAccuracy: number;
  parityGap: number;
  withinParity: boolean;
  accepted: boolean;
  reason: string;
  /** TODO23 Phase 2: frozen-set non-regression report (present when frozen cases supplied). */
  frozen?: {
    baselineBrier: number;
    candidateBrier: number;
    nonRegression: boolean;
  };
}

const HASH_PINNED = /^sha256:[0-9a-f]{64}$/;

/** Bench 10: promoted head matches incumbent accuracy on shadow bake-off within 2%. */
export function runBakeOff(
  _incumbent: HeadCandidateSpec | undefined,
  _candidate: HeadCandidateSpec,
  cases: readonly BakeOffCase[],
  parityTolerance = 0.02,
  _eceBound = 0.1,
  /** Governance option: accept strictly-better candidates beyond the tolerance window (reject only regressions). */
  acceptImprovements = false,
  /** TODO23 Phase 2: frozen eval-set cases — promotion requires non-regression here. */
  frozen?: { cases: readonly BakeOffCase[]; tolerance?: number }
): BakeOffResult {
  const brier = (key: 'incumbent' | 'candidate') =>
    cases.length === 0
      ? 0
      : cases.reduce((sum, c) => sum + (c[key] - c.truth) ** 2, 0) / cases.length;
  const incumbentAccuracy = 1 - brier('incumbent');
  const candidateAccuracy = 1 - brier('candidate');
  const parityGap = Math.abs(candidateAccuracy - incumbentAccuracy);
  const withinParity = parityGap <= parityTolerance;

  // Frozen-set non-regression gate: the candidate may never score worse than
  // the incumbent on the digest-pinned snapshot beyond the tolerance window.
  let frozenReport: BakeOffResult['frozen'];
  if (frozen && frozen.cases.length > 0) {
    const fb = (key: 'incumbent' | 'candidate') =>
      frozen.cases.reduce((sum, c) => sum + (c[key] - c.truth) ** 2, 0) / frozen.cases.length;
    const baselineBrier = fb('incumbent');
    const candidateBrier = fb('candidate');
    const tolerance = frozen.tolerance ?? parityTolerance;
    const nonRegression = candidateBrier <= baselineBrier + tolerance;
    frozenReport = { baselineBrier, candidateBrier, nonRegression };
    if (!nonRegression) {
      return {
        incumbentAccuracy,
        candidateAccuracy,
        parityGap,
        withinParity,
        accepted: false,
        reason: `Frozen-set regression: candidate Brier ${candidateBrier.toFixed(4)} > baseline ${baselineBrier.toFixed(4)} + tolerance ${tolerance}`,
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

export interface SabotageVerdict {
  accepted: boolean;
  violations: string[];
}

/**
 * Bench 14: sabotage gate. Rejects and flags:
 * - un-pinned model digest (supply-chain compromise)
 * - relaxed abstain threshold τ (safety-floor erosion)
 * - disabled injection head (fail-closed removal)
 */
export function validateHeadCandidate(
  candidate: HeadCandidateSpec,
  incumbent?: HeadCandidateSpec
): SabotageVerdict {
  const violations: string[] = [];
  if (!HASH_PINNED.test(candidate.modelDigest)) {
    violations.push(
      `Un-pinned modelDigest '${candidate.modelDigest}' — head must be hash-pinned (SHA256(weights))`
    );
  }
  if (incumbent && candidate.abstainThreshold < incumbent.abstainThreshold) {
    violations.push(
      `Relaxed abstainThreshold ${candidate.abstainThreshold} < incumbent ${incumbent.abstainThreshold} — monotonic safety forbids`
    );
  }
  if (candidate.headId === 'injection' && !candidate.enabled) {
    violations.push('Disabled injection head — fail-closed safety floor cannot be removed');
  }
  return { accepted: violations.length === 0, violations };
}

// ─── Governed promotion (§9.2 — reuse the governance pipeline verbatim) ──────

/** Head swap = MEDIUM risk; SandboxValidator has no automated checks → held for review. */
export function buildHeadSwapProposal(
  candidate: HeadCandidateSpec,
  bakeOff: BakeOffResult
): SelfImprovementProposal {
  return {
    proposalId: uuidv4(),
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
export function buildSabotageFlag(
  candidate: HeadCandidateSpec,
  violations: readonly string[]
): SelfImprovementProposal {
  return {
    proposalId: uuidv4(),
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
