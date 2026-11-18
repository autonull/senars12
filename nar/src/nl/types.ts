/**
 * NL generation types — extracted to break generation.ts <-> prompts/generation-v1.ts cycle.
 */

export interface BeliefInfo {
  term: string;
  truth?: { f: number; c: number };
}

export interface DerivationTrace {
  steps: number;
  beliefs: BeliefInfo[];
  newBeliefs: BeliefInfo[];
}

export interface ConflictInfo {
  belief: BeliefInfo;
  conflictWith: BeliefInfo;
  type: 'direct' | 'frequency' | 'implication';
}