/**
 * Term builder - constructs Term objects from parsed components
 */
import type {Term} from './types.js';
import {TermFactory} from './factory.js';

export const buildInheritance = (subject: Term, predicate: Term): Term =>
  TermFactory.inheritance(subject, predicate);

export const buildSimilarity = (t1: Term, t2: Term): Term =>
  TermFactory.similarity(t1, t2);

export const buildImplication = (antecedent: Term, consequent: Term): Term =>
  TermFactory.implication(antecedent, consequent);

export const buildEquivalence = (a: Term, c: Term): Term =>
  TermFactory.equivalence(a, c);

export const buildConjunction = (...terms: Term[]): Term =>
  TermFactory.conjunction(...terms);

export const buildDisjunction = (...terms: Term[]): Term =>
  TermFactory.disjunction(...terms);

export const buildNegation = (term: Term): Term =>
  TermFactory.negation(term);

export const buildAtom = (symbol: string): Term =>
  TermFactory.atom(symbol);

export const buildInstance = (term: Term): Term =>
  TermFactory.instance(term);

export const buildProperty = (term: Term): Term =>
  TermFactory.property(term);

export const buildSequence = (a: Term, b: Term): Term =>
  TermFactory.sequence(a, b);

export const buildParallel = (a: Term, b: Term): Term =>
  TermFactory.parallel(a, b);

export const buildPredictive = (a: Term, b: Term): Term =>
  TermFactory.predictive(a, b);

export const buildRetrospective = (a: Term, b: Term): Term =>
  TermFactory.retrospective(a, b);

export const buildOperation = (op: Term, input: Term): Term =>
  TermFactory.operation(op, input);

export const buildCompound = (kind: string, args: Term[]): Term =>
  TermFactory.compound(kind as any, args);
