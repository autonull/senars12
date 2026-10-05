import type { OperatorKey, Term } from './types.js';
import { COMMUTATIVE_OPS, NARY_OPS } from './operators.js';
import { getArgs, hasNegatedPair, hasRepeatedArgs, termKey } from './impls/accessors.js';
import { compoundOf, isBoolAtom, atomOf } from './impls/intern.js';

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
const distinct = (args: readonly Term[]): Term[] => {
  const seen = new Set<string>();
  return args.filter((arg) => {
    const key = termKey(arg);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

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
  justification: 'Nested conjunction/disjunction/parallel/product is structurally identical to flat form (associativity); Op.java DISJ/CONJ/PROD n-ary definitions',
  applies: (term) => FLATTENED.has(kindOf(term)) && getArgs(term).some((arg) => arg.kind === term.kind),
  reduce: (term) =>
    compoundOf(
      kindOf(term),
      getArgs(term).flatMap((arg) => (arg.kind === term.kind ? getArgs(arg) : [arg]))
    ),
};

const dedupeArgs: TermReducer = {
  id: 'dedupe-args',
  justification: 'Duplicate arguments in commutative n-ary kinds do not change the claim (idempotence); Op.java CONJ/DISJ/PAR semantics',
  applies: (term) => DEDUPED.has(kindOf(term)) && hasRepeatedArgs(term),
  reduce: (term) => compoundOf(kindOf(term), distinct(getArgs(term))),
};

const doubleNegation: TermReducer = {
  id: 'double-negation',
  justification: '--(--x) ≡ x (double negation elimination); NAL negation semantics, symmetric with negate-true/negate-false',
  applies: (term) => term.kind === 'negation' && getArgs(term)[0]?.kind === 'negation',
  reduce: (term) => getArgs(getArgs(term)[0] as Term)[0] as Term,
};

/** `--TRUE = FALSE` — symmetric with double-negation. */
const negateTrue: TermReducer = {
  id: 'negate-true',
  justification: '--TRUE = FALSE (negation of truth constant); Op.java Bool atom semantics, NOT operator on TRUE',
  applies: (term) =>
    term.kind === 'negation' && getArgs(term)[0]?.kind === 'atom' && getArgs(term)[0]!.symbol === 'TRUE',
  reduce: (term) => atomOf('FALSE'),
};

/** `--FALSE = TRUE` */
const negateFalse: TermReducer = {
  id: 'negate-false',
  justification: '--FALSE = TRUE (negation of false constant); Op.java Bool atom semantics, NOT operator on FALSE',
  applies: (term) =>
    term.kind === 'negation' && getArgs(term)[0]?.kind === 'atom' && getArgs(term)[0]!.symbol === 'FALSE',
  reduce: (term) => atomOf('TRUE'),
};

/** `a & TRUE = a` — TRUE is the identity for conjunction. */
const conjunctionTrue: TermReducer = {
  id: 'conjunction-true',
  justification: 'a & TRUE = a (TRUE is conjunction identity); Op.java CONJ Args.GTETwo with TRUE absorption',
  applies: (term) =>
    term.kind === 'conjunction' &&
    getArgs(term).some((arg) => isBoolAtom(arg) && arg.symbol === 'TRUE'),
  reduce: (term) =>
    compoundOf(
      'conjunction',
      getArgs(term).filter((arg) => !(isBoolAtom(arg) && arg.symbol === 'TRUE'))
    ),
};

/** `a & FALSE = FALSE` — FALSE absorbs conjunction. */
const conjunctionFalse: TermReducer = {
  id: 'conjunction-false',
  justification: 'a & FALSE = FALSE (FALSE absorbs conjunction); Op.java CONJ Args.GTETwo with FALSE absorption',
  applies: (term) =>
    term.kind === 'conjunction' &&
    getArgs(term).some((arg) => isBoolAtom(arg) && arg.symbol === 'FALSE'),
  reduce: () => atomOf('FALSE'),
};

/** `a | TRUE = TRUE` — TRUE absorbs disjunction. */
const disjunctionTrue: TermReducer = {
  id: 'disjunction-true',
  justification: 'a | TRUE = TRUE (TRUE absorbs disjunction); Op.java DISJ case 0->True with TRUE absorption',
  applies: (term) =>
    term.kind === 'disjunction' &&
    getArgs(term).some((arg) => isBoolAtom(arg) && arg.symbol === 'TRUE'),
  reduce: () => atomOf('TRUE'),
};

/** `a | FALSE = a` — FALSE is the identity for disjunction. */
const disjunctionFalse: TermReducer = {
  id: 'disjunction-false',
  justification: 'a | FALSE = a (FALSE is disjunction identity); Op.java DISJ case 1->x[0] with FALSE absorption',
  applies: (term) =>
    term.kind === 'disjunction' &&
    getArgs(term).some((arg) => isBoolAtom(arg) && arg.symbol === 'FALSE'),
  reduce: (term) =>
    compoundOf(
      'disjunction',
      getArgs(term).filter((arg) => !(isBoolAtom(arg) && arg.symbol === 'FALSE'))
    ),
};

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
