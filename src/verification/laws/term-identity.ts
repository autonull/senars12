import { Term } from '../../kernel/terms/intern';
import { DerivationRecord } from '../record';
import type { LawResult } from './types';

/** Law 13: Term Identity (Interning) */
export function verifyTermIdentity(records: DerivationRecord[]): LawResult {
  let holds = true;
  let counterexample: unknown = undefined;

  for (const record of records) {
    const seen = new Map<Term, string>();
    for (const step of record.steps) {
      for (const premise of step.premises) {
        const existing = seen.get(premise.term);
        if (existing && existing !== premise.stamp.id) {
          holds = false;
          counterexample = { term: premise.term, stamp1: existing, stamp2: premise.stamp.id };
          break;
        }
        seen.set(premise.term, premise.stamp.id);
      }
      const existing = seen.get(step.conclusion);
      if (existing && existing !== step.stamp.id) {
        holds = false;
        counterexample = { term: step.conclusion, stamp1: existing, stamp2: step.stamp.id };
        break;
      }
      seen.set(step.conclusion, step.stamp.id);
    }
    if (!holds) break;
  }

  return {
    law: 'term_identity',
    holds,
    counterexample,
    description: 'Same term (by identity) must have same stamp within a derivation',
    severity: 'critical',
  };
}