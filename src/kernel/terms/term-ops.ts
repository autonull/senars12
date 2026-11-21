/**
 * Term Operators — shared term operator definitions.
 *
 * Separated to break circular dependencies between term.ts, intern.ts,
 * formatters.ts, and narsese.ts.
 */

/** Term operator types. */
export enum TermOp {
  VARIABLE = 'var',
  CONSTANT = 'const',
  INHERITANCE = '-->',
  SIMILARITY = '<->',
  IMPLICATION = '==>',
  EQUIVALENCE = '<=>',
  CONJUNCTION = '&',
  DISJUNCTION = '|',
  NEGATION = '~',
  PRODUCT = '*',
  EXTENSIONAL_IMAGE = '@',
  INTENSIONAL_IMAGE = '#',
  PREDICTION = '|>',
  CONCURRENT = '||',
  SEQUENTIAL = ';',
  PARALLEL = '|~',
  STATEMENT = '.',
  QUESTION = '?',
  GOAL = '!',
}