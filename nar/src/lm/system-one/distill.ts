import { createHash } from 'node:crypto';
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
  source: string;
}

/** Append-only, redaction-per-retention: hashes + labels, never raw text. */
export class JudgmentDataset {
  #labels: DistillationLabel[] = [];

  record(label: DistillationLabel): void {
    this.#labels.push(label);
  }

  all(): readonly DistillationLabel[] {
    return this.#labels;
  }

  get size(): number {
    return this.#labels.length;
  }
}
