import { TruthValue } from '../../kernel/truth';
import { Truth } from '../../kernel/truth';
import type { LawResult } from './types';

/** Law 5: Negation Involution */
export function verifyNegationInvolution(): LawResult {
  let holds = true;
  let counterexample: unknown = undefined;

  const testValues: TruthValue[] = [
    Truth.TRUE,
    Truth.FALSE,
    Truth.NEUTRAL,
    { f: 0.0, c: 0.1 },
    { f: 0.2, c: 0.5 },
    { f: 0.7, c: 0.9 },
    { f: 1.0, c: 0.8 },
  ];

  for (const t of testValues) {
    const neg = Truth.negation(t);
    const negNeg = Truth.negation(neg);
    if (!Truth.equals(t, negNeg)) {
      holds = false;
      counterexample = { t, neg, negNeg };
      break;
    }
  }

  return {
    law: 'negation_involution',
    holds,
    counterexample,
    description: 'Double negation should return original truth: ~~A = A',
    severity: 'critical',
  };
}