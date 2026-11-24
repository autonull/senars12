import { Term, TermOp, termInterner } from '../../../kernel/terms/intern';
import { Truth, type TruthOp, type TruthValue } from '../../../kernel/truth';
import { getArgs } from '../../../kernel/terms/term-internal/compound';
import type { Premise } from '../../../kernel/step';
import { SenarsError } from '../../../errors/senars-error';
import type { NALRule } from './types';

/** Wrap a function to check premises length matches arity. */
function withArity<const N extends 1 | 2, R>(
  arity: N,
  fn: (premises: N extends 1 ? [Premise] : [Premise, Premise]) => R
): (premises: Premise[]) => R {
  return (premises: Premise[]) => {
    if (premises.length < arity) {
      throw new SenarsError(`Expected at least ${arity} premises, got ${premises.length}`, 'VALIDATION_ERROR', { expected: arity, got: premises.length });
    }
    return fn(premises as N extends 1 ? [Premise] : [Premise, Premise]);
  };
}

/** Term helpers. */
function isInheritance(term: Term): boolean {
  return term.op === TermOp.INHERITANCE;
}

function isSimilarity(term: Term): boolean {
  return term.op === TermOp.SIMILARITY;
}

function getSubject(term: Term): Term {
  const args = getArgs(term);
  if (!args || args.length < 1) throw new SenarsError('Expected compound term with at least 1 arg', 'VALIDATION_ERROR', { term: term.toString(), argCount: args?.length ?? 0 });
  return args[0]!;
}

function getPredicate(term: Term): Term {
  const args = getArgs(term);
  if (!args || args.length < 2) throw new SenarsError('Expected compound term with at least 2 args', 'VALIDATION_ERROR', { term: term.toString(), argCount: args?.length ?? 0 });
  return args[1]!;
}

function termsEqual(a: Term, b: Term): boolean {
  return a === b;
}

function createInheritance(subject: Term, predicate: Term): Term {
  return termInterner.inheritance(subject, predicate);
}

function createSimilarity(subject: Term, predicate: Term): Term {
  return termInterner.similarity(subject, predicate);
}

function createProduct(...terms: Term[]): Term {
  return termInterner.product(...terms);
}

function createNegation(term: Term): Term {
  return termInterner.negation(term);
}

/** Core syllogistic rules (NAL-1 to NAL-4). */
export const CORE_RULES: NALRule[] = [
  // Deduction: S1-->P1, S2-->P2 | P1==S2 => S1-->P2
  {
    id: 'deduction',
    name: 'Deduction',
    category: 'deduction',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthOp: 'deduction',
    priority: 100,
    condition: withArity(2, ([m, n]) =>
      isInheritance(m.term) && isInheritance(n.term) &&
      termsEqual(getPredicate(m.term), getSubject(n.term))
    ),
    buildConclusion: withArity(2, ([m, n]) =>
      createInheritance(getSubject(m.term), getPredicate(n.term))
    ),
  },

  // Induction: S1-->P, S2-->P => S1-->S2
  {
    id: 'induction',
    name: 'Induction',
    category: 'induction',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthOp: 'induction',
    priority: 90,
    condition: withArity(2, ([m, n]) =>
      isInheritance(m.term) && isInheritance(n.term) &&
      termsEqual(getPredicate(m.term), getPredicate(n.term))
    ),
    buildConclusion: withArity(2, ([m, n]) =>
      createInheritance(getSubject(m.term), getSubject(n.term))
    ),
  },

  // Abduction: S-->P1, S-->P2 => P1-->P2
  {
    id: 'abduction',
    name: 'Abduction',
    category: 'abduction',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthOp: 'abduction',
    priority: 80,
    condition: withArity(2, ([m, n]) =>
      isInheritance(m.term) && isInheritance(n.term) &&
      termsEqual(getSubject(m.term), getSubject(n.term))
    ),
    buildConclusion: withArity(2, ([m, n]) =>
      createInheritance(getPredicate(m.term), getPredicate(n.term))
    ),
  },

  // Revision: same term, different evidence
  {
    id: 'revision',
    name: 'Revision',
    category: 'revision',
    arity: 2,
    premiseRoles: ['belief1', 'belief2'],
    truthOp: 'revision',
    priority: 95,
    condition: withArity(2, ([a, b]) => a.term === b.term),
    buildConclusion: withArity(2, ([a]) => a.term),
  },
];