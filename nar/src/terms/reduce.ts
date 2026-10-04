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

/**
 * Whether a `conjunction` or `disjunction` of `kind` contains both `a` and `--a`.
 *
 * One predicate for both self-contradiction laws: the two rewrites differ only in
 * the constant they reduce to, so the pair test is stated once and each reducer
 * declares its own result.
 */
const containsNegatedPair = (term: Term, kind: 'conjunction' | 'disjunction'): boolean => {
  if (term.kind !== kind) return false;
  const args = argsOf(term);
  return args.some(
    (arg) => arg.kind === 'negation' && args.some((other) => termsEqual(other, arg.args[0]))
  );
};

/** `a & --a = FALSE` — contradiction in conjunction. */
const conjunctionContradiction: TermReducer = {
  id: 'conjunction-contradiction',
  justification: 'a & --a = FALSE (self-contradiction in conjunction); NAL negation semantics',
  applies: (term) => containsNegatedPair(term, 'conjunction'),
  reduce: () => atomOf('FALSE'),
};

/** `a | --a = TRUE` — tautology in disjunction. */
const disjunctionTautology: TermReducer = {
  id: 'disjunction-tautology',
  justification: 'a | --a = TRUE (tautology in disjunction); NAL negation semantics',
  applies: (term) => containsNegatedPair(term, 'disjunction'),
  reduce: () => atomOf('TRUE'),
};

const flattenNested: TermReducer = {
  id: 'flatten-nested',
  justification: 'Nested conjunction/disjunction/parallel/product is structurally identical to flat form (associativity); Op.java DISJ/CONJ/PROD n-ary definitions',
  applies: (term) => FLATTENED.has(term.kind) && argsOf(term).some((arg) => arg.kind === term.kind),
  reduce: (term) =>
    compoundOf(
      kindOf(term),
      argsOf(term).flatMap((arg) => (arg.kind === term.kind ? argsOf(arg) : [arg]))
    ),
};

const dedupeArgs: TermReducer = {
  id: 'dedupe-args',
  justification: 'Duplicate arguments in commutative n-ary kinds do not change the claim (idempotence); Op.java CONJ/DISJ/PAR semantics',
  applies: (term) => DEDUPED.has(term.kind) && distinct(argsOf(term)).length !== argsOf(term).length,
  reduce: (term) => compoundOf(kindOf(term), distinct(argsOf(term))),
};

const doubleNegation: TermReducer = {
  id: 'double-negation',
  justification: '--(--x) ≡ x (double negation elimination); NAL negation semantics, symmetric with negate-true/negate-false',
  applies: (term) => term.kind === 'negation' && argsOf(term)[0]?.kind === 'negation',
  reduce: (term) => argsOf(argsOf(term)[0] as Term)[0] as Term,
};

/** `--TRUE = FALSE` — symmetric with double-negation. */
const negateTrue: TermReducer = {
  id: 'negate-true',
  justification: '--TRUE = FALSE (negation of truth constant); Op.java Bool atom semantics, NOT operator on TRUE',
  applies: (term) =>
    term.kind === 'negation' && argsOf(term)[0]?.kind === 'atom' && argsOf(term)[0]!.symbol === 'TRUE',
  reduce: (term) => atomOf('FALSE'),
};

/** `--FALSE = TRUE` */
const negateFalse: TermReducer = {
  id: 'negate-false',
  justification: '--FALSE = TRUE (negation of false constant); Op.java Bool atom semantics, NOT operator on FALSE',
  applies: (term) =>
    term.kind === 'negation' && argsOf(term)[0]?.kind === 'atom' && argsOf(term)[0]!.symbol === 'FALSE',
  reduce: (term) => atomOf('TRUE'),
};

/** `a & TRUE = a` — TRUE is the identity for conjunction. */
const conjunctionTrue: TermReducer = {
  id: 'conjunction-true',
  justification: 'a & TRUE = a (TRUE is conjunction identity); Op.java CONJ Args.GTETwo with TRUE absorption',
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
  justification: 'a & FALSE = FALSE (FALSE absorbs conjunction); Op.java CONJ Args.GTETwo with FALSE absorption',
  applies: (term) =>
    term.kind === 'conjunction' &&
    argsOf(term).some((arg) => isBoolAtom(arg) && arg.symbol === 'FALSE'),
  reduce: () => atomOf('FALSE'),
};

/** `a | TRUE = TRUE` — TRUE absorbs disjunction. */
const disjunctionTrue: TermReducer = {
  id: 'disjunction-true',
  justification: 'a | TRUE = TRUE (TRUE absorbs disjunction); Op.java DISJ case 0->True with TRUE absorption',
  applies: (term) =>
    term.kind === 'disjunction' &&
    argsOf(term).some((arg) => isBoolAtom(arg) && arg.symbol === 'TRUE'),
  reduce: () => atomOf('TRUE'),
};

/** `a | FALSE = a` — FALSE is the identity for disjunction. */
const disjunctionFalse: TermReducer = {
  id: 'disjunction-false',
  justification: 'a | FALSE = a (FALSE is disjunction identity); Op.java DISJ case 1->x[0] with FALSE absorption',
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

/** Recursively apply reducers to all subterms, then to the term itself. */
const canonicalizeRecursive = (term: Term): Term => {
  if (term.kind === 'atom') return term;
  
  // First canonicalize all arguments
  const canonicalArgs = term.args.map(canonicalizeRecursive);
  
  // Rebuild the term with canonicalized args (bypassing factory to avoid re-canonicalizing)
  const rebuilt = compoundOf(term.kind as OperatorKey, canonicalArgs);
  
  // Now apply reducers to this rebuilt term
  let current = rebuilt;
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

export const canonicalTerm = (term: Term): Term => canonicalizeRecursive(term);
