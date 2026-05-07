export * from './types.js';
export { TermBuilder, freeze } from './factory.js';
export * from './truth.js';
export * from './stamp.js';
export * from './normalize.js';
export * from './cache.js';
export * from './unifier.js';
export * from './parser.js';
export { isInheritance, isSimilarity, isImplication, isEquivalence, isConjunction, isDisjunction, isNegation, getSubject, getPredicate, getAntecedent, getConsequent, getArgs, sameHash, sameKind } from './accessors.js';