import { TruthValue } from '../../kernel/truth';
import { Truth } from '../../kernel/truth';
import { DerivationRecord, DerivationStepRecord } from '../record';
import type { LawResult } from './types';

/** Law 3: Revision Commutativity */
export function verifyRevisionCommutativity(records: DerivationRecord[]): LawResult {
  let holds = true;
  let counterexample: unknown = undefined;

  for (const record of records) {
    for (const step of record.steps) {
      if (step.ruleId !== 'revision') continue;
      const premises = step.premises;
      if (premises.length < 2) continue;
      const p1 = premises[0];
      const p2 = premises[1];
      if (!p1 || !p2) continue;
      const rev12 = Truth.revision(p1.truth, p2.truth);
      const rev21 = Truth.revision(p2.truth, p1.truth);
      if (!Truth.equals(rev12, rev21)) {
        holds = false;
        counterexample = { step: step.id, p1: p1.truth, p2: p2.truth, rev12, rev21 };
        break;
      }
    }
    if (!holds) break;
  }

  return {
    law: 'revision_commutativity',
    holds,
    counterexample,
    description: 'Revision should be commutative: rev(A, B) = rev(B, A)',
    severity: 'critical',
  };
}

/** Law 4: Revision Associativity */
export function verifyRevisionAssociativity(records: DerivationRecord[]): LawResult {
  let holds = true;
  let counterexample: unknown = undefined;

  // Test with sample truth values since we need 3 premises
  const testValues: TruthValue[] = [
    { f: 1.0, c: 0.9 },
    { f: 0.8, c: 0.7 },
    { f: 0.5, c: 0.6 },
    { f: 0.3, c: 0.4 },
    { f: 0.0, c: 0.5 },
  ];

  for (const a of testValues) {
    for (const b of testValues) {
      for (const c of testValues) {
        const ab_c = Truth.revision(Truth.revision(a, b), c);
        const a_bc = Truth.revision(a, Truth.revision(b, c));
        if (!Truth.equals(ab_c, a_bc)) {
          holds = false;
          counterexample = { a, b, c, ab_c, a_bc };
          break;
        }
      }
      if (!holds) break;
    }
    if (!holds) break;
  }

  return {
    law: 'revision_associativity',
    holds,
    counterexample,
    description: 'Revision should be associative: rev(rev(A, B), C) = rev(A, rev(B, C))',
    severity: 'critical',
  };
}