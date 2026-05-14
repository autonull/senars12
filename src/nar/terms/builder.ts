/**
 * Term builder - re-exports from TermFactory for convenience
 */
import type {Term} from './types.js';
import {TermFactory} from './factory.js';

export const buildInheritance = TermFactory.inheritance;
export const buildSimilarity = TermFactory.similarity;
export const buildImplication = TermFactory.implication;
export const buildEquivalence = TermFactory.equivalence;
export const buildConjunction = TermFactory.conjunction;
export const buildDisjunction = TermFactory.disjunction;
export const buildNegation = TermFactory.negation;
export const buildAtom = TermFactory.atom;
export const buildInstance = TermFactory.instance;
export const buildProperty = TermFactory.property;
export const buildSequence = TermFactory.sequence;
export const buildParallel = TermFactory.parallel;
export const buildPredictive = TermFactory.predictive;
export const buildRetrospective = TermFactory.retrospective;
export const buildOperation = TermFactory.operation;
export const buildCompound = (kind: string, args: Term[]) => TermFactory.compound(kind as any, args);