/**
 * Self-concept NAR port — the subset of NAR that initializeSelfConcept needs.
 * Extracted to break self-concept.ts <-> nar.ts cycle.
 */

import type { TruthType } from '../../types';

export interface SelfConceptNAR {
  believe(term: string, truth?: TruthType): Promise<void>;
}