/**
 * Self-concept NAR port — the subset of NAR that initializeSelfConcept needs.
 * Extracted to break self-concept.ts <-> nar.ts cycle.
 */

export interface SelfConceptNAR {
  believe(term: string, truth: { f: number; c: number }): Promise<void>;
}