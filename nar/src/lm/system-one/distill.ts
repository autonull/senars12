import { createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import type { SelfImprovementProposal } from '@senars/kernel/schemas';
import { Truth, type Truth as TruthType } from '../../terms/truth.js';
import { seedTruth } from './seed.js';
import type { JudgmentProposition } from './types.js';

/** Input-anchored evidence identity: same utterance ⇒ same evidence, regardless of re-judging. */
export function computeEvidenceId(utteranceId: string, sourceSpan: string): string {
  return createHash('sha256').update(`${utteranceId}::${sourceSpan}`).digest('hex');
}

/**
 * Promotion of a provisional hypothesis by a later judgment pass.
 * Evidence-weighted revision caps at MAX_CONFIDENCE — re-judging the same
 * evidence never inflates confidence beyond the NAL revision bound.
 */
export function promoteProvisional(current: TruthType | undefined, incoming: JudgmentProposition): TruthType {
  const incomingTruth = seedTruth(incoming);
  return current ? Truth.revision(current, incomingTruth) : incomingTruth;
}

export interface DistillationLabel {
  evidenceId: string;
  rubric: string;
  axis: string;
  label: string;
  score?: number;
  /** Ground-truth outcome recorded at label time (D2 calibration input). */
  observed?: number;
  /** Vector-sidecar key this row joins to (Z1: usually the state vector, not the action row). */
  vecRef?: string;
  source: string;
  /** H5/X18: which Cortex model produced the candidates this label judged. */
  cortexModelId?: string;
}

/** Append-only, redaction-per-retention: hashes + labels, never raw text. */
export class JudgmentDataset {
  #labels: DistillationLabel[] = [];
  #vectors = new Map<string, Float32Array>();
  #vectorSidecarPath?: string;

  /** Configure the binary vector sidecar directory (Z1). */
  setVectorSidecarPath(path: string): void {
    this.#vectorSidecarPath = path;
  }

  record(label: DistillationLabel, embedding?: Float32Array): void {
    this.#labels.push(label);
    if (embedding) this.#vectors.set(label.evidenceId, embedding);
  }

  /** Record a raw state embedding keyed by evidenceId (Z1 vector sidecar). */
  recordVector(evidenceId: string, embedding: Float32Array): void {
    this.#vectors.set(evidenceId, embedding);
  }

  getVector(evidenceId: string): Float32Array | undefined {
    return this.#vectors.get(evidenceId);
  }

  /** Flush recorded vectors to the sidecar directory as `<evidenceId>.f32`. */
  async flushVectors(): Promise<number> {
    if (this.#vectors.size === 0 || !this.#vectorSidecarPath) return 0;
    const { promises: fs } = await import('node:fs');
    const { join } = await import('node:path');
    await fs.mkdir(this.#vectorSidecarPath, { recursive: true });
    for (const [evidenceId, vec] of this.#vectors) {
      const bytes = Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
      await fs.writeFile(join(this.#vectorSidecarPath, `${evidenceId}.f32`), bytes);
    }
    return this.#vectors.size;
  }

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
      await fs.appendFile(path, jsonl + '\n', 'utf-8');
    }
  }

  /** Load a JSONL file and replace the current dataset. */
  static async load(path: string): Promise<JudgmentDataset> {
    const { promises: fs } = await import('node:fs');
    const dataset = new JudgmentDataset();
    try {
      const content = await fs.readFile(path, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const label = JSON.parse(line) as DistillationLabel;
          dataset.record(label);
        } catch {
          // Skip malformed lines
        }
      }
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }
    return dataset;
  }

  /** Periodic append of recorded labels to `path` (D3 auto-flush). Returns a stop function. */
  startAutoFlush(path: string, intervalMs = 30_000): () => void {
    const timer = setInterval(() => {
      void this.flush(path).catch(() => {
        // Auto-flush is best-effort; the next tick retries.
      });
    }, intervalMs);
    timer.unref?.();
    return () => clearInterval(timer);
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
}

const HASH_PINNED = /^sha256:[0-9a-f]{64}$/;

/** Bench 10: promoted head matches incumbent accuracy on shadow bake-off within 2%. */
export function runBakeOff(
  incumbent: HeadCandidateSpec | undefined,
  candidate: HeadCandidateSpec,
  cases: readonly BakeOffCase[],
  parityTolerance = 0.02,
  eceBound = 0.1
): BakeOffResult {
  const brier = (key: 'incumbent' | 'candidate') =>
    cases.length === 0
      ? 0
      : cases.reduce((sum, c) => sum + (c[key] - c.truth) ** 2, 0) / cases.length;
  const incumbentAccuracy = 1 - brier('incumbent');
  const candidateAccuracy = 1 - brier('candidate');
  const parityGap = Math.abs(candidateAccuracy - incumbentAccuracy);
  const withinParity = parityGap <= parityTolerance;

  if (!withinParity) {
    return {
      incumbentAccuracy,
      candidateAccuracy,
      parityGap,
      withinParity,
      accepted: false,
      reason: `Parity gap ${parityGap.toFixed(4)} exceeds tolerance ${parityTolerance}`,
    };
  }
  return {
    incumbentAccuracy,
    candidateAccuracy,
    parityGap,
    withinParity,
    accepted: true,
    reason: `Parity gap ${parityGap.toFixed(4)} within tolerance; candidate accuracy ${candidateAccuracy.toFixed(4)}`,
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
    violations.push(`Un-pinned modelDigest '${candidate.modelDigest}' — head must be hash-pinned (SHA256(weights))`);
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
