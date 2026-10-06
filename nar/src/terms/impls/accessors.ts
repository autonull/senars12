import { type EqualityDialect, getOrInsert, structuralEqual } from '@senars/util';
import type { AtomicTerm, CompoundTerm, OperatorKey, Term } from '../types.js';
import { isAtomic, isVariableSymbol, type OPERATORS } from '../types.js';

export const isType = <K extends OperatorKey>(k: K, t: Term): t is CompoundTerm<K> => t.kind === k;

// The kind list is `OperatorKey`, not a hand-written copy of it: a guard table
// that has to be updated when an operator is added is a second source of truth
// about which kinds exist, which is what `terms:canonical` exists to catch.
//
// This is the only file that declares a kind guard. The NAL rules carried a
// second table of the same predicates under short names (`inh`, `conj`, …),
// covering seven kinds this file also covered and four it did not — so a rule
// pattern could name a kind whose guard lived in a different package.
const createTypeGuard =
  <K extends OperatorKey>(kind: K) =>
  (t: Term): t is CompoundTerm<K> =>
    isType(kind, t);
export const isInheritance = createTypeGuard('inheritance');
export const isSimilarity = createTypeGuard('similarity');
export const isImplication = createTypeGuard('implication');
export const isEquivalence = createTypeGuard('equivalence');
export const isConjunction = createTypeGuard('conjunction');
export const isDisjunction = createTypeGuard('disjunction');
export const isNegation = createTypeGuard('negation');
export const isSequence = createTypeGuard('sequence');
export const isPredictive = createTypeGuard('predictive');
export const isSetExt = createTypeGuard('setExt');
export const isSetInt = createTypeGuard('setInt');
export const isOperation = createTypeGuard('operation');

/**
 * The kinds whose argument list is exactly a pair, derived from the operator
 * table rather than listed here — a second list of binary kinds is a list that
 * does not learn about a new operator.
 */
export type BinaryKind = {
  [K in OperatorKey]: (typeof OPERATORS)[K]['arity'] extends 2 ? K : never;
}[OperatorKey];

/**
 * A unary term's own argument, or `undefined` when `term` is not `kind`.
 *
 * The {@link binaryOf} counterpart, for the same reason: `isNegation(t)` says
 * the kind and `t.args[0]` says the argument, and a rule that needs both wrote
 * the first as a guard for the second. A negation built outside the factory can
 * carry no argument at all, so the arity check is real.
 */
export const unaryOf = <K extends UnaryKind>(kind: K, term: Term): Term | undefined => {
  if (term.kind !== kind) return undefined;
  return term.args[0];
};

/** An unpacked binary term: argument zero, then argument one. */
export type TermPair = readonly [Term, Term];

/** The kinds whose argument list is exactly one, from the same operator table. */
export type UnaryKind = {
  [K in OperatorKey]: (typeof OPERATORS)[K]['arity'] extends 1 ? K : never;
}[OperatorKey];

const NO_ARGS: readonly Term[] = Object.freeze([]);

/**
 * A term's arguments, for a term that is not known to be a compound.
 *
 * The one place `kind === 'atom' ? … : term.args` is spelled. It was spelled three
 * ways — as `getTermArgs`, as `getArgs`, as `reduce.ts`'s `argsOf` — plus a dozen
 * inline copies, and the three disagreed about what an atom has: `undefined`,
 * the empty list, or a *fresh* empty list allocated per call, which every
 * reducer asking an atom for its arguments paid for. An atom has no arguments,
 * so the empty list is the whole answer, and a frozen singleton says so.
 */
export const getArgs = (term: Term): readonly Term[] =>
  term.kind === 'atom' ? NO_ARGS : (term.args ?? NO_ARGS);

/**
 * A binary term's own argument list as a pair, or `undefined` when `term` is not
 * `kind` or does not carry both arguments.
 *
 * The kind guard, the arity check and the unpack, once. Reading a binary term
 * positionally is otherwise three statements — `if (t.kind !== 'implication')`,
 * `const [a, c] = t.args`, `if (!a || !c)` — and the third restates the first: a
 * term that passed the kind guard still has to be *known* to hold two arguments,
 * because `Term` admits an `args` of any length and only the factory enforces
 * the operator's arity.
 *
 * Returns the list itself rather than a fresh object, so the per-premise-pair
 * path allocates nothing. For an inheritance the pair reads `(subject,
 * predicate)` and for an implication `(antecedent, consequent)`; the role
 * accessors below name the same two slots one at a time.
 */
export const binaryOf = <K extends BinaryKind>(kind: K, term: Term): TermPair | undefined => {
  if (term.kind !== kind) return undefined;
  const args = term.args;
  return args.length >= 2 ? (args as TermPair) : undefined;
};

const getRoleArg = (term: Term, index: 0 | 1, k1: BinaryKind, k2: BinaryKind): Term | undefined =>
  (binaryOf(k1, term) ?? binaryOf(k2, term))?.[index];

export const getSubject = (term: Term): Term | undefined =>
  getRoleArg(term, 0, 'inheritance', 'similarity');
export const getPredicate = (term: Term): Term | undefined =>
  getRoleArg(term, 1, 'inheritance', 'similarity');
export const getAntecedent = (term: Term): Term | undefined =>
  getRoleArg(term, 0, 'implication', 'equivalence');
export const getConsequent = (term: Term): Term | undefined =>
  getRoleArg(term, 1, 'implication', 'equivalence');

/**
 * `term`'s subject and predicate together — the pair form of {@link getSubject}
 * and {@link getPredicate}, over the two kinds that carry both roles.
 *
 * The pair, not the accessors, because a rule that matches on *both* roles used
 * to read them one at a time and then check both were present, which is the same
 * guard spelled twice. It is also the only reader that cannot guess wrong about
 * kind: the dispatch cell for these rules is `inheritance`/`similarity`, so the
 * same body serves `S--P, P<->Q` and `S--P, P--Q` without naming which kind the
 * second premise was.
 */
export const rolePair = (term: Term): TermPair | undefined =>
  binaryOf('inheritance', term) ?? binaryOf('similarity', term);

export const sameKind = (a: Term, b: Term): boolean => a.kind === b.kind;

/**
 * Equality of a term's own payload. A compound's head *is* its kind, and a kind
 * has no spelling of its own, so this answers atoms and defers everything else to
 * the descent that {@link structuralEqual} runs through the arguments.
 */
const sameTerm = (a: Term, b: Term): boolean =>
  isAtomic(a) ? a.symbol === (b as AtomicTerm).symbol : true;

/** How a structural comparison reads a Narsese term. */
export const TERM_EQUALITY: EqualityDialect<Term> = {
  variableName: (t) => (isAtomic(t) && isVariableSymbol(t.symbol) ? t.symbol : null),
  sameHead: sameKind,
  equal: sameTerm,
  children: getArgs,
};

/**
 * Structural term equality. `undefined` is accepted so optional-arg probes need no guard.
 *
 * Terms are interned, so this is usually the identity test one line up; the walk
 * exists for the terms that were built outside the factory.
 */
export const termsEqual = (a: Term | undefined, b: Term | undefined): boolean =>
  a === undefined || b === undefined ? a === b : structuralEqual(TERM_EQUALITY, a, b);

export type TermWalkOrder = 'pre-order' | 'post-order';

/**
 * The single term-tree walk. `fn` receives depth from the root and may return
 * `false` to prune that node's subtree; `'post-order'` visits children first.
 */
export const walkTerms = (
  term: Term,
  fn: (t: Term, depth: number) => boolean | void,
  order: TermWalkOrder = 'pre-order',
  depth = 0
): void => {
  if (order === 'pre-order' && fn(term, depth) === false) return;
  for (const arg of getArgs(term)) walkTerms(arg, fn, order, depth + 1);
  if (order === 'post-order') fn(term, depth);
};

export const visitTerms = (term: Term, fn: (t: Term) => void): void =>
  walkTerms(term, (t) => void fn(t));

/** Depth-first pre-order fold in visit order. */
export const foldTerm = <T>(term: Term, fn: (acc: T, t: Term) => T, initial: T): T => {
  let acc = initial;
  walkTerms(term, (t) => {
    acc = fn(acc, t);
  });
  return acc;
};

/** Deepest nesting below the root; a bare atom has depth 0. */
export const termDepth = (term: Term): number => {
  let max = 0;
  walkTerms(term, (_t, depth) => {
    max = Math.max(max, depth);
  });
  return max;
};

/** Node count including the root. */
export const termSize = (term: Term): number => {
  let n = 0;
  walkTerms(term, () => {
    n++;
  });
  return n;
};

/**
 * Terms are interned by `TermFactory`, so structurally equal terms are the same
 * object and a fact derived from one is computed once rather than once per
 * lookup. Every derived fact — the structural key, the symbol bag, the set of
 * subterm keys, the bare inheritance pair — lives in this one `WeakMap`, because
 * each is the same argument made repeatedly and a second cache is a second thing
 * to forget.
 *
 * Keyed on identity and holding only value types, so an evicted term takes its
 * facts with it, and a term built outside the factory simply misses the cache.
 * Fields are filled on first read rather than in one pass: a term is very often
 * asked only for its key.
 */
interface TermFacts {
  key?: string;
  symbols?: ReadonlySet<string>;
  atoms?: readonly AtomicTerm[];
  subterms?: ReadonlySet<string>;
  /** `null` once computed and found absent — distinct from "not yet looked at". */
  pair?: BareInheritance | null;
  variable?: boolean;
  repeatedArgs?: boolean;
  negatedPair?: boolean;
}

type FactValue = TermFacts[keyof TermFacts];

const factsCache = new WeakMap<Term, TermFacts>();

/** Hoisted so `factsOf` allocates nothing on a hit: `getOrInsert` takes its
 *  factory as an argument, and a factory written at the call site is built on
 *  every call even when it is never invoked. */
const emptyFacts = (): TermFacts => ({});

const factsOf = (term: Term): TermFacts => getOrInsert(factsCache, term, emptyFacts);

/**
 * Read a lazily-derived fact, deriving it on the first ask and keeping it for
 * every later reader of the same (interned) term. `undefined` is the one value
 * that means "not derived yet", so a derived `null` or `false` still caches.
 *
 * `derive` takes the term rather than closing over it, because these are all
 * *memo reads* — `termKey` alone is called for every map lookup, set membership
 * and link id in the engine — and a closure passed as an argument is built
 * before the cache check runs. Three allocations per read, on the hit path, to
 * throw them away: the memo's own overhead tax, on the hottest accessor there
 * is. Naming each derivation once at module scope costs the hit path nothing.
 */
const memoFact = <V extends FactValue>(
  term: Term,
  slot: keyof TermFacts,
  derive: (term: Term) => V
): V => {
  const facts = factsOf(term);
  const cached = facts[slot];
  if (cached !== undefined) return cached as V;
  const value = derive(term);
  (facts as Record<string, FactValue>)[slot] = value;
  return value;
};

/** An atom's key without building the term — the read side of `termKey` for callers holding a symbol. */
export const atomKey = (symbol: string): string => `atom:${symbol}`;

/** Canonical structural key for a term — the single identity used for maps, memoization, and link ids. */
/** Prefixing every atom makes the derivation injective, where joining bare
 *  `toString()` forms let any symbol containing `,` alias a different arity. */
const deriveKey = (term: Term): string =>
  isAtomic(term) ? atomKey(term.symbol) : `${term.kind}:${getArgs(term).map(termKey).join(',')}`;

/** Canonical structural key for a term — the single identity used for maps, memoization, and link ids. */
export const termKey = (term: Term): string => memoFact(term, 'key', deriveKey);

/** Every atomic symbol mentioned anywhere in the term. */
const deriveSymbols = (term: Term): ReadonlySet<string> => {
  const symbols = new Set<string>();
  walkTerms(term, (t) => {
    if (isAtomic(t)) symbols.add(t.symbol);
  });
  return symbols;
};

export const atomicSymbols = (term: Term): ReadonlySet<string> =>
  memoFact(term, 'symbols', deriveSymbols);

/**
 * Every atom in the term's subtree, in pre-order and with repeats — the
 * {@link atomicSymbols} walk keeping the terms rather than their symbols.
 *
 * The graph extractors need the terms (they serialize each one into an edge), so
 * they each ran the walk privately and re-serialized the same atoms inside an
 * O(n²) pairing loop. Memoised on the same facts as the symbol set, so a term
 * that has been asked for its symbols already has this.
 */
const deriveAtoms = (term: Term): readonly AtomicTerm[] => {
  const atoms: AtomicTerm[] = [];
  walkTerms(term, (t) => {
    if (isAtomic(t)) atoms.push(t);
  });
  return atoms;
};

export const atomicTerms = (term: Term): readonly AtomicTerm[] => memoFact(term, 'atoms', deriveAtoms);

/**
 * `termKey` of every node in the term's subtree, the root included.
 * `termKey` equality is structural equality — two terms with the same key agree
 * on kind, arity and every argument recursively — so membership here is exactly
 * "this term occurs somewhere in the other".
 */
const deriveSubterms = (term: Term): ReadonlySet<string> => {
  const keys = new Set<string>();
  walkTerms(term, (t) => {
    keys.add(termKey(t));
  });
  return keys;
};

const subtermKeys = (term: Term): ReadonlySet<string> => memoFact(term, 'subterms', deriveSubterms);

export const containsSubterm = (term: Term, target: Term): boolean =>
  subtermKeys(term).has(termKey(target));

export const sharesSymbol = (a: Term, b: Term): boolean => {
  const aSyms = atomicSymbols(a);
  const bSyms = atomicSymbols(b);
  for (const s of aSyms) if (bSyms.has(s)) return true;
  return false;
};

export const mentionsSymbol = (term: Term, symbol: string): boolean =>
  atomicSymbols(term).has(symbol);

/**
 * Whether any two of `term`'s arguments are the same term.
 *
 * Memoised because `terms/reduce.ts` asks this of every compound term it
 * canonicalises — and it asked it eleven reducers deep, twice per construction,
 * so the `Set` that answers it was allocated twenty-two times for one term.
 * `termKey` is already memoised, so deriving the answer costs one `Set` per term
 * rather than one per visit.
 */
const deriveRepeatedArgs = (term: Term): boolean => {
  const args = getArgs(term);
  return args.length !== new Set(args.map(termKey)).size;
};

export const hasRepeatedArgs = (term: Term): boolean =>
  memoFact(term, 'repeatedArgs', deriveRepeatedArgs);

/**
 * Whether `term`'s arguments contain both `a` and `--a`.
 *
 * The property, not the law: the two self-contradiction rewrites differ only in
 * the constant they reduce to, so the predicate is asked once here and each law
 * declares its own result.
 */
const deriveNegatedPair = (term: Term): boolean => {
  const args = getArgs(term);
  const keys = new Set(args.map(termKey));
  return args.some((arg) => {
    if (arg.kind !== 'negation') return false;
    const operand = getArgs(arg)[0];
    return operand !== undefined && keys.has(termKey(operand));
  });
};

export const hasNegatedPair = (term: Term): boolean =>
  memoFact(term, 'negatedPair', deriveNegatedPair);

/** Whether any atom anywhere in the term is a variable — structural, not a spelling test. */
const deriveVariable = (term: Term): boolean => {
  let found = false;
  walkTerms(term, (t) => {
    if (!found && isAtomic(t) && isVariableSymbol(t.symbol)) found = true;
  });
  return found;
};

export const hasVariable = (term: Term): boolean => memoFact(term, 'variable', deriveVariable);

/** The two symbols of a bare `a --> b` pair. */
export interface BareInheritance {
  readonly subject: string;
  readonly predicate: string;
}

/**
 * The first bare inheritance pair mentioned anywhere in the term — `(bird --> animal)`
 * when the term is that pair, and the pair a compound mentions when it is not.
 *
 * Reachability by shared subject or predicate is a question about the tree, and
 * asking it of the term's *string* form re-derived structure the term already
 * carried: a regex plus two string allocations per concept, on a caller that
 * walks every concept in memory. Terms are interned, so the answer is computed
 * once per term and shared by every reader; `null` is cached too, so the
 * majority of concepts that mention no pair cost one `WeakMap` read.
 */
const deriveBarePair = (term: Term): BareInheritance | null => {
  let found: BareInheritance | null = null;
  walkTerms(term, (t) => {
    if (found || t.kind !== 'inheritance') return;
    const [subject, predicate] = getArgs(t);
    if (subject?.kind === 'atom' && predicate?.kind === 'atom') {
      found = { subject: subject.symbol, predicate: predicate.symbol };
    }
  });
  return found;
};

export const bareInheritancePair = (term: Term): BareInheritance | null =>
  memoFact(term, 'pair', deriveBarePair);

/** True when the two terms mention a bare inheritance pair sharing an end. */
export const sharesInheritanceEnd = (a: Term, b: Term): boolean => {
  const x = bareInheritancePair(a);
  if (!x) return false;
  const y = bareInheritancePair(b);
  if (!y) return false;
  return (
    x.subject === y.subject ||
    x.subject === y.predicate ||
    x.predicate === y.subject ||
    x.predicate === y.predicate
  );
};
