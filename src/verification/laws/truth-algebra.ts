import { TruthValue } from '../../kernel/truth';
import { Truth } from '../../kernel/truth';
import type { LawResult } from './types';

/** Law 1: Truth Algebra Laws */
export function verifyTruthAlgebraLaws(): LawResult[] {
  const results: LawResult[] = [];

  // Negation involution: ~~A = A
  let holds = true;
  for (const t of [Truth.TRUE, Truth.FALSE, Truth.NEUTRAL, { f: 0.8, c: 0.9 }]) {
    const neg = Truth.negation(t);
    const negNeg = Truth.negation(neg);
    if (!Truth.equals(t, negNeg)) {
      holds = false;
      results.push({
        law: 'negation_involution',
        holds: false,
        counterexample: { t, neg, negNeg },
        description: 'Double negation should return original truth',
        severity: 'critical',
      });
      break;
    }
  }
  if (holds) {
    results.push({
      law: 'negation_involution',
      holds: true,
      description: 'Double negation returns original truth value',
      severity: 'critical',
    });
  }

  // Conjunction commutativity: A & B = B & A
  holds = true;
  for (const a of [Truth.TRUE, Truth.FALSE, Truth.NEUTRAL, { f: 0.3, c: 0.7 }]) {
    for (const b of [Truth.TRUE, Truth.FALSE, Truth.NEUTRAL, { f: 0.6, c: 0.8 }]) {
      const ab = Truth.conjunction(a, b);
      const ba = Truth.conjunction(b, a);
      if (!Truth.equals(ab, ba)) {
        holds = false;
        results.push({
          law: 'conjunction_commutativity',
          holds: false,
          counterexample: { a, b, ab, ba },
          description: 'Conjunction should be commutative',
          severity: 'critical',
        });
        break;
      }
    }
    if (!holds) break;
  }
  if (holds) {
    results.push({
      law: 'conjunction_commutativity',
      holds: true,
      description: 'Conjunction is commutative',
      severity: 'critical',
    });
  }

  // Disjunction commutativity: A | B = B | A
  holds = true;
  for (const a of [Truth.TRUE, Truth.FALSE, Truth.NEUTRAL, { f: 0.3, c: 0.7 }]) {
    for (const b of [Truth.TRUE, Truth.FALSE, Truth.NEUTRAL, { f: 0.6, c: 0.8 }]) {
      const ab = Truth.disjunction(a, b);
      const ba = Truth.disjunction(b, a);
      if (!Truth.equals(ab, ba)) {
        holds = false;
        results.push({
          law: 'disjunction_commutativity',
          holds: false,
          counterexample: { a, b, ab, ba },
          description: 'Disjunction should be commutative',
          severity: 'critical',
        });
        break;
      }
    }
    if (!holds) break;
  }
  if (holds) {
    results.push({
      law: 'disjunction_commutativity',
      holds: true,
      description: 'Disjunction is commutative',
      severity: 'critical',
    });
  }

  // Conjunction associativity: (A & B) & C = A & (B & C)
  holds = true;
  const testValues: TruthValue[] = [
    Truth.TRUE,
    Truth.FALSE,
    Truth.NEUTRAL,
    { f: 0.2, c: 0.5 },
    { f: 0.7, c: 0.9 },
    { f: 0.4, c: 0.6 },
  ];
  for (const a of testValues) {
    for (const b of testValues) {
      for (const c of testValues) {
        const ab_c = Truth.conjunction(Truth.conjunction(a, b), c);
        const a_bc = Truth.conjunction(a, Truth.conjunction(b, c));
        if (!Truth.equals(ab_c, a_bc)) {
          holds = false;
          results.push({
            law: 'conjunction_associativity',
            holds: false,
            counterexample: { a, b, c, ab_c, a_bc },
            description: 'Conjunction should be associative',
            severity: 'critical',
          });
          break;
        }
      }
      if (!holds) break;
    }
    if (!holds) break;
  }
  if (holds) {
    results.push({
      law: 'conjunction_associativity',
      holds: true,
      description: 'Conjunction is associative',
      severity: 'critical',
    });
  }

  // Disjunction associativity: (A | B) | C = A | (B | C)
  holds = true;
  for (const a of testValues) {
    for (const b of testValues) {
      for (const c of testValues) {
        const ab_c = Truth.disjunction(Truth.disjunction(a, b), c);
        const a_bc = Truth.disjunction(a, Truth.disjunction(b, c));
        if (!Truth.equals(ab_c, a_bc)) {
          holds = false;
          results.push({
            law: 'disjunction_associativity',
            holds: false,
            counterexample: { a, b, c, ab_c, a_bc },
            description: 'Disjunction should be associative',
            severity: 'critical',
          });
          break;
        }
      }
      if (!holds) break;
    }
    if (!holds) break;
  }
  if (holds) {
    results.push({
      law: 'disjunction_associativity',
      holds: true,
      description: 'Disjunction is associative',
      severity: 'critical',
    });
  }

  // De Morgan: ~(A & B) = ~A | ~B
  holds = true;
  for (const a of testValues) {
    for (const b of testValues) {
      const left = Truth.negation(Truth.conjunction(a, b));
      const right = Truth.disjunction(Truth.negation(a), Truth.negation(b));
      if (!Truth.equals(left, right)) {
        holds = false;
        results.push({
          law: 'de_morgan_conjunction',
          holds: false,
          counterexample: { a, b, left, right },
          description: 'De Morgan law: negation of conjunction equals disjunction of negations',
          severity: 'critical',
        });
        break;
      }
    }
    if (!holds) break;
  }
  if (holds) {
    results.push({
      law: 'de_morgan_conjunction',
      holds: true,
      description: 'De Morgan: negation of conjunction equals disjunction of negations',
      severity: 'critical',
    });
  }

  // De Morgan: ~(A | B) = ~A & ~B
  holds = true;
  for (const a of testValues) {
    for (const b of testValues) {
      const left = Truth.negation(Truth.disjunction(a, b));
      const right = Truth.conjunction(Truth.negation(a), Truth.negation(b));
      if (!Truth.equals(left, right)) {
        holds = false;
        results.push({
          law: 'de_morgan_disjunction',
          holds: false,
          counterexample: { a, b, left, right },
          description: 'De Morgan law: negation of disjunction equals conjunction of negations',
          severity: 'critical',
        });
        break;
      }
    }
    if (!holds) break;
  }
  if (holds) {
    results.push({
      law: 'de_morgan_disjunction',
      holds: true,
      description: 'De Morgan: negation of disjunction equals conjunction of negations',
      severity: 'critical',
    });
  }

  // Absorption: A & (A | B) = A
  holds = true;
  for (const a of testValues) {
    for (const b of testValues) {
      const left = Truth.conjunction(a, Truth.disjunction(a, b));
      if (!Truth.equals(left, a)) {
        holds = false;
        results.push({
          law: 'absorption_conjunction',
          holds: false,
          counterexample: { a, b, left },
          description: 'Absorption: A & (A | B) = A',
          severity: 'major',
        });
        break;
      }
    }
    if (!holds) break;
  }
  if (holds) {
    results.push({
      law: 'absorption_conjunction',
      holds: true,
      description: 'Absorption: A & (A | B) = A',
      severity: 'major',
    });
  }

  // Absorption: A | (A & B) = A
  holds = true;
  for (const a of testValues) {
    for (const b of testValues) {
      const left = Truth.disjunction(a, Truth.conjunction(a, b));
      if (!Truth.equals(left, a)) {
        holds = false;
        results.push({
          law: 'absorption_disjunction',
          holds: false,
          counterexample: { a, b, left },
          description: 'Absorption: A | (A & B) = A',
          severity: 'major',
        });
        break;
      }
    }
    if (!holds) break;
  }
  if (holds) {
    results.push({
      law: 'absorption_disjunction',
      holds: true,
      description: 'Absorption: A | (A & B) = A',
      severity: 'major',
    });
  }

  return results;
}