import { uniqueBy } from '@senars/util';
import { getArgs, hasNegatedPair, hasRepeatedArgs, termKey } from './impls/accessors.js';
import { atomOf, compoundOf, isBoolAtom } from './impls/intern.js';
import { COMMUTATIVE_OPS, NARY_OPS } from './operators.js';
import type { OperatorKey, Term } from './types.js';

/**
 * One NAL rewrite, declared and enumerable (TODO29.a §5.12).
 *
 * Two obligations make a reducer a reducer rather than a `case` in the factory:
 * `applies` is false for every canonical term, so canonicalising one costs a
 * single pass and allocates nothing; and reducers commute, which the fixed point
 * below is what tests. A reducer that cannot see its own effect from a canonical
 * term does not terminate.
 *
 * **Admissibility (TODO30 §2.4):** a reducer may fire only when the two terms are
 * the **same claim** — same readback (serialised form), same injectivity class
 * (`termKey`), and for Boolean laws, an exact structural identity rather than a
 * truth-function coincidence. A reducer that fires "usually" is a heuristic in a
 * place the architecture promised it would not be one.
 */
export interface TermReducer {
  readonly id: string;
  /** Human-readable justification citing the NAL identity or reference rule. */
  readonly justification: string;
  applies(term: Term): boolean;
  reduce(term: Term): Term;
}

/**
 * Nesting is meaningless for exactly the n-ary kinds, and `product` is
 * associative but **not** commutative (`(*,a,b) ≠ (*,b,a)`) — so it flattens and
 * is never sorted, and only a commutative n-ary kind may drop a repeat. Never
 * implication, equivalence, the two set kinds or `sequence`: there, nesting and
 * order *are* the claim.
 *
 * Both sets are read off the operator table rather than written out. Flattening
 * *is* n-ary-ness and dropping a repeat additionally requires commutativity, so
 * the declaration is the whole rule — an operator declared `nary` picks up
 * associativity automatically, and this list can no longer fall behind the table
 * it is derived from.
 */
const FLATTENED: ReadonlySet<OperatorKey> = NARY_OPS;
const DEDUPED: ReadonlySet<OperatorKey> = new Set(
  [...NARY_OPS].filter((kind) => COMMUTATIVE_OPS.has(kind))
);

/** `Term` is a union over two interfaces rather than a discriminated one, so narrowing `term.kind` does not narrow the term. */
const kindOf = (term: Term): OperatorKey => term.kind as OperatorKey;

/**
 * Structural equality by `termKey` membership rather than by pairwise
 * `termsEqual`, which is a recursive tree walk and made deduplication quadratic
 * in the arity of every compound the cycle built.
 */
const distinct = (args: readonly Term[]): Term[] => uniqueBy(args, termKey);

/** `a & --a = FALSE` — contradiction in conjunction. */
const conjunctionContradiction: TermReducer = {
  id: 'conjunction-contradiction',
  justification: 'a & --a = FALSE (self-contradiction in conjunction); NAL negation semantics',
  applies: (term) => term.kind === 'conjunction' && hasNegatedPair(term),
  reduce: () => atomOf('FALSE'),
};

/** `a | --a = TRUE` — tautology in disjunction. */
const disjunctionTautology: TermReducer = {
  id: 'disjunction-tautology',
  justification: 'a | --a = TRUE (tautology in disjunction); NAL negation semantics',
  applies: (term) => term.kind === 'disjunction' && hasNegatedPair(term),
  reduce: () => atomOf('TRUE'),
};

const flattenNested: TermReducer = {
  id: 'flatten-nested',
  justification:
    'Nested conjunction/disjunction/parallel/product is structurally identical to flat form (associativity); Op.java DISJ/CONJ/PROD n-ary definitions',
  applies: (term) =>
    FLATTENED.has(kindOf(term)) && getArgs(term).some((arg) => arg.kind === term.kind),
  reduce: (term) =>
    compoundOf(
      kindOf(term),
      getArgs(term).flatMap((arg) => (arg.kind === term.kind ? getArgs(arg) : [arg]))
    ),
};

const dedupeArgs: TermReducer = {
  id: 'dedupe-args',
  justification:
    'Duplicate arguments in commutative n-ary kinds do not change the claim (idempotence); Op.java CONJ/DISJ/PAR semantics',
  applies: (term) => DEDUPED.has(kindOf(term)) && hasRepeatedArgs(term),
  reduce: (term) => compoundOf(kindOf(term), distinct(getArgs(term))),
};

const doubleNegation: TermReducer = {
  id: 'double-negation',
  justification:
    '--(--x) ≡ x (double negation elimination); NAL negation semantics, symmetric with negate-true/negate-false',
  applies: (term) => term.kind === 'negation' && getArgs(term)[0]?.kind === 'negation',
  reduce: (term) => getArgs(getArgs(term)[0] as Term)[0] as Term,
};

type BoolSymbol = 'TRUE' | 'FALSE';
const other = (symbol: BoolSymbol): BoolSymbol => (symbol === 'TRUE' ? 'FALSE' : 'TRUE');

/**
 * `--TRUE = FALSE` and its complement, declared once. The two reducers were
 * character-identical apart from the constant, and the constant is the whole law.
 */
const negateBool = (symbol: BoolSymbol): TermReducer => ({
  id: `negate-${symbol.toLowerCase()}`,
  justification: `--${symbol} = ${other(symbol)} (negation of ${symbol.toLowerCase()} constant); Op.java Bool atom semantics, NOT operator on ${symbol}`,
  applies: (term) =>
    term.kind === 'negation' &&
    getArgs(term)[0]?.kind === 'atom' &&
    getArgs(term)[0]!.symbol === symbol,
  reduce: () => atomOf(other(symbol)),
});

/**
 * `a & TRUE = a`, `a & FALSE = FALSE`, `a | TRUE = TRUE`, `a | FALSE = a`.
 *
 * One Boolean law for every n-ary operator and both constants. `symbol` is the
 * constant the term carries; `absorbing` decides the result — an absorber replaces
 * the whole term with itself, an identity is dropped and the rest of the term
 * survives. The four were four copies of one guard and one two-shaped `reduce`,
 * with conjunction's and disjunction's polarities written out by hand and nothing
 * holding them in step.
 */
const boolAbsorb = (
  id: string,
  kind: OperatorKey,
  symbol: BoolSymbol,
  absorbing: boolean,
  law: string
): TermReducer => ({
  id,
  justification:
    `a ${law} ${symbol} = ${absorbing ? symbol : 'a'} ` +
    `(${symbol} ${absorbing ? `absorbs ${law}` : `is the identity for ${law}`}); ` +
    `Op.java ${kind.toUpperCase()} with ${symbol} ${absorbing ? 'absorption' : 'identity'}`,
  applies: (term) =>
    term.kind === kind && getArgs(term).some((arg) => isBoolAtom(arg) && arg.symbol === symbol),
  reduce: (term) =>
    absorbing
      ? atomOf(symbol)
      : compoundOf(
          kind,
          getArgs(term).filter((arg) => !(isBoolAtom(arg) && arg.symbol === symbol))
        ),
});

const negateTrue = negateBool('TRUE');
const negateFalse = negateBool('FALSE');

/** `a & TRUE = a` — TRUE is the identity for conjunction. */
const conjunctionTrue = boolAbsorb('conjunction-true', 'conjunction', 'TRUE', false, '&');

/** `a & FALSE = FALSE` — FALSE absorbs conjunction. */
const conjunctionFalse = boolAbsorb('conjunction-false', 'conjunction', 'FALSE', true, '&');

/** `a | TRUE = TRUE` — TRUE absorbs disjunction. */
const disjunctionTrue = boolAbsorb('disjunction-true', 'disjunction', 'TRUE', true, '|');

/** `a | FALSE = a` — FALSE is the identity for disjunction. */
const disjunctionFalse = boolAbsorb('disjunction-false', 'disjunction', 'FALSE', false, '|');

export const TERM_REDUCERS: readonly TermReducer[] = Object.freeze([
  flattenNested,
  dedupeArgs,
  conjunctionContradiction,
  disjunctionTautology,
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

/**
 * Memo of `subterm → its canonical form`.
 *
 * Every public construction path canonicalises, and interning makes structurally
 * equal terms one object — so the second `canonicalTerm` of a given compound has
 * the same answer as the first, and the answer is already in hand. Keyed on
 * identity and holding only terms, so an evicted compound takes its entry with
 * it, and a term built outside the factory simply misses.
 */
const canonicalCache = new WeakMap<Term, Term>();

/** Recursively apply reducers to all subterms, then to the term itself. */
const canonicalizeRecursive = (term: Term): Term => {
  if (term.kind === 'atom') return term;
  const memo = canonicalCache.get(term);
  if (memo) return memo;

  // Rebuild with canonicalized args (raw factory, so a reducer's own output does
  // not re-enter the reducer pipeline)
  let current = compoundOf(kindOf(term), term.args.map(canonicalizeRecursive));

  let settled = false;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const next = TERM_REDUCERS.reduce(
      (acc, reducer) => (reducer.applies(acc) ? reducer.reduce(acc) : acc),
      current
    );
    if (next === current) {
      settled = true;
      break;
    }
    current = next;
  }
  if (!settled) {
    throw new Error(`canonicalTerm did not reach a fixed point in ${MAX_PASSES} passes: ${term}`);
  }

  // The canonical form answers for itself, so a term that has been through here
  // once is a hit on every later construction of the same claim.
  canonicalCache.set(current, current);
  if (current !== term) canonicalCache.set(term, current);
  return current;
};

export const canonicalTerm = (term: Term): Term => canonicalizeRecursive(term);
