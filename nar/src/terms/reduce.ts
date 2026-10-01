import type { OperatorKey, Term } from './types.js';
import { termsEqual } from './impls/accessors.js';
import { compoundOf, isBoolAtom, atomOf } from './impls/intern.js';

/**
 * One NAL rewrite, declared and enumerable (TODO29.a §5.12).
 *
 * Two obligations make a reducer a reducer rather than a `case` in the factory:
 * `applies` is false for every canonical term, so canonicalising one costs a
 * single pass and allocates nothing; and reducers commute, which the fixed point
 * below is what tests. A reducer that cannot see its own effect from a canonical
 * term does not terminate.
 */
export interface TermReducer {
  readonly id: string;
  applies(term: Term): boolean;
  reduce(term: Term): Term;
}

/**
 * Nesting is meaningless for exactly these four kinds, and `product` is
 * associative but **not** commutative (`(*,a,b) ≠ (*,b,a)`) — so it flattens and
 * is never sorted, and only a commutative n-ary kind may drop a repeat. Never
 * implication, equivalence, the two set kinds or `sequence`: there, nesting and
 * order *are* the claim.
 */
const FLATTENED = new Set<string>(['conjunction', 'disjunction', 'parallel', 'product']);
const DEDUPED = new Set<string>(['conjunction', 'disjunction', 'parallel']);

const argsOf = (term: Term): readonly Term[] => (term.kind === 'atom' ? [] : term.args);

/** `Term` is a union over two interfaces rather than a discriminated one, so narrowing `term.kind` does not narrow the term. */
const kindOf = (term: Term): OperatorKey => term.kind as OperatorKey;

const distinct = (args: readonly Term[]): Term[] =>
  args.filter((arg, index) => args.findIndex((other) => termsEqual(arg, other)) === index);

const flattenNested: TermReducer = {
  id: 'flatten-nested',
  applies: (term) => FLATTENED.has(term.kind) && argsOf(term).some((arg) => arg.kind === term.kind),
  reduce: (term) =>
    compoundOf(
      kindOf(term),
      argsOf(term).flatMap((arg) => (arg.kind === term.kind ? argsOf(arg) : [arg]))
    ),
};

const dedupeArgs: TermReducer = {
  id: 'dedupe-args',
  // `compoundOf` folds the single-distinct-member case into the member itself.
  applies: (term) => DEDUPED.has(term.kind) && distinct(argsOf(term)).length !== argsOf(term).length,
  reduce: (term) => compoundOf(kindOf(term), distinct(argsOf(term))),
};

const doubleNegation: TermReducer = {
  id: 'double-negation',
  applies: (term) => term.kind === 'negation' && argsOf(term)[0]?.kind === 'negation',
  reduce: (term) => argsOf(argsOf(term)[0] as Term)[0] as Term,
};

/** `--TRUE = FALSE` — symmetric with double-negation. */
const negateTrue: TermReducer = {
  id: 'negate-true',
  applies: (term) =>
    term.kind === 'negation' && argsOf(term)[0]?.kind === 'atom' && argsOf(term)[0]!.symbol === 'TRUE',
  reduce: (term) => atomOf('FALSE'),
};

/** `--FALSE = TRUE` */
const negateFalse: TermReducer = {
  id: 'negate-false',
  applies: (term) =>
    term.kind === 'negation' && argsOf(term)[0]?.kind === 'atom' && argsOf(term)[0]!.symbol === 'FALSE',
  reduce: (term) => atomOf('TRUE'),
};

/** `a & TRUE = a` — TRUE is the identity for conjunction. */
const conjunctionTrue: TermReducer = {
  id: 'conjunction-true',
  applies: (term) =>
    term.kind === 'conjunction' &&
    argsOf(term).some((arg) => isBoolAtom(arg) && arg.symbol === 'TRUE'),
  reduce: (term) =>
    compoundOf(
      'conjunction',
      argsOf(term).filter((arg) => !(isBoolAtom(arg) && arg.symbol === 'TRUE'))
    ),
};

/** `a & FALSE = FALSE` — FALSE absorbs conjunction. */
const conjunctionFalse: TermReducer = {
  id: 'conjunction-false',
  applies: (term) =>
    term.kind === 'conjunction' &&
    argsOf(term).some((arg) => isBoolAtom(arg) && arg.symbol === 'FALSE'),
  reduce: () => atomOf('FALSE'),
};

/** `a | TRUE = TRUE` — TRUE absorbs disjunction. */
const disjunctionTrue: TermReducer = {
  id: 'disjunction-true',
  applies: (term) =>
    term.kind === 'disjunction' &&
    argsOf(term).some((arg) => isBoolAtom(arg) && arg.symbol === 'TRUE'),
  reduce: () => atomOf('TRUE'),
};

/** `a | FALSE = a` — FALSE is the identity for disjunction. */
const disjunctionFalse: TermReducer = {
  id: 'disjunction-false',
  applies: (term) =>
    term.kind === 'disjunction' &&
    argsOf(term).some((arg) => isBoolAtom(arg) && arg.symbol === 'FALSE'),
  reduce: (term) =>
    compoundOf(
      'disjunction',
      argsOf(term).filter((arg) => !(isBoolAtom(arg) && arg.symbol === 'FALSE'))
    ),
};

export const TERM_REDUCERS: readonly TermReducer[] = Object.freeze([
  flattenNested,
  dedupeArgs,
  doubleNegation,
  negateTrue,
  negateFalse,
  conjunctionTrue,
  conjunctionFalse,
  disjunctionTrue,
  disjunctionFalse,
]);

/** Three reducers need two passes; the ceiling turns a non-terminating reducer into one loud error rather than a hang in the reasoning cycle. */
const MAX_PASSES = 8;

export const canonicalTerm = (term: Term): Term => {
  let current = term;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const next = TERM_REDUCERS.reduce(
      (acc, reducer) => (reducer.applies(acc) ? reducer.reduce(acc) : acc),
      current
    );
    if (next === current) return current;
    current = next;
  }
  throw new Error(`canonicalTerm did not reach a fixed point in ${MAX_PASSES} passes: ${term}`);
};
