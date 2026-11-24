import { Term, TermOp, termInterner } from '../../../kernel/terms/intern';
import { getArgs } from '../../../kernel/terms/term-internal/compound';
import type { Premise } from '../../../kernel/step';
import { SenarsError } from '../../../errors/senars-error';
import type { NALRule } from './types';

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

function isSequential(term: Term): boolean {
  return term.op === TermOp.SEQUENTIAL;
}

function isPrediction(term: Term): boolean {
  return term.op === TermOp.PREDICTION;
}

function getArgsSafe(term: Term): readonly Term[] {
  const args = getArgs(term);
  if (!args || args.length < 2) throw new SenarsError('Expected compound term with at least 2 args', 'VALIDATION_ERROR', { term: term.toString(), argCount: args?.length ?? 0 });
  return args;
}

function createPrediction(antecedent: Term, consequent: Term): Term {
  return termInterner.prediction(antecedent, consequent);
}

function createSequential(first: Term, second: Term): Term {
  return termInterner.sequential(first, second);
}

/** Temporal rules (NAL-7). */
export const NAL_TEMPORAL_RULES: NALRule[] = [
  // Prediction: (A | B) => (A |> B)
  {
    id: 'prediction',
    name: 'Prediction',
    category: 'temporal',
    arity: 1,
    premiseRoles: ['premise'],
    truthOp: 'deduction',
    priority: 60,
    condition: withArity(1, ([p]) => isSequential(p.term)),
    buildConclusion: withArity(1, ([p]) => {
      const args = getArgsSafe(p.term);
      return createPrediction(args[0]!, args[1]!);
    }),
  },

  // Postdiction: (A |> B) => (A | B)
  {
    id: 'postdiction',
    name: 'Postdiction',
    category: 'temporal',
    arity: 1,
    premiseRoles: ['premise'],
    truthOp: 'deduction',
    priority: 60,
    condition: withArity(1, ([p]) => isPrediction(p.term)),
    buildConclusion: withArity(1, ([p]) => {
      const args = getArgsSafe(p.term);
      return createSequential(args[0]!, args[1]!);
    }),
  },
];