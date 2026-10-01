import type { CompoundTerm, OperatorKey, Term } from '../types.js';
import { isAtomic } from '../types.js';

export const isType = <K extends OperatorKey>(k: K, t: Term): t is CompoundTerm<K> => t.kind === k;

const createTypeGuard =
  <
    K extends
      | 'inheritance'
      | 'similarity'
      | 'implication'
      | 'equivalence'
      | 'conjunction'
      | 'disjunction'
      | 'negation'
      | 'setExt'
      | 'setInt'
      | 'sequence'
      | 'parallel'
      | 'predictive'
      | 'retrospective'
      | 'operation',
  >(
    kind: K
  ) =>
  (t: Term): t is CompoundTerm<K> =>
    isType(kind, t);
export const isInheritance = createTypeGuard('inheritance');
export const isSimilarity = createTypeGuard('similarity');
export const isImplication = createTypeGuard('implication');
export const isEquivalence = createTypeGuard('equivalence');
export const isConjunction = createTypeGuard('conjunction');
export const isDisjunction = createTypeGuard('disjunction');
export const isNegation = createTypeGuard('negation');
export const isOperation = createTypeGuard('operation');

const getRoleArg = (
  term: Term,
  index: 0 | 1,
  k1: Term['kind'],
  k2: Term['kind']
): Term | undefined => (term.kind === k1 || term.kind === k2 ? term.args?.[index] : undefined);

export const getSubject = (term: Term): Term | undefined =>
  getRoleArg(term, 0, 'inheritance', 'similarity');
export const getPredicate = (term: Term): Term | undefined =>
  getRoleArg(term, 1, 'inheritance', 'similarity');
export const getAntecedent = (term: Term): Term | undefined =>
  getRoleArg(term, 0, 'implication', 'equivalence');
export const getConsequent = (term: Term): Term | undefined =>
  getRoleArg(term, 1, 'implication', 'equivalence');

const NO_ARGS: readonly Term[] = Object.freeze([]);

export const getArgs = (term: Term): readonly Term[] =>
  term.kind === 'atom' ? NO_ARGS : (term.args ?? []);
export const sameKind = (a: Term, b: Term): boolean => a.kind === b.kind;

/** Structural term equality. `undefined` is accepted so optional-arg probes need no guard. */
export const termsEqual = (a: Term | undefined, b: Term | undefined): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'atom') return a.symbol === b.symbol;
  const aArgs = a.args ?? [];
  const bArgs = b.args ?? [];
  if (aArgs.length !== bArgs.length) return false;
  for (let i = 0; i < aArgs.length; i++) {
    if (!termsEqual(aArgs[i], bArgs[i])) return false;
  }
  return true;
};

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
  subterms?: ReadonlySet<string>;
  /** `null` once computed and found absent — distinct from "not yet looked at". */
  pair?: BareInheritance | null;
}

const factsCache = new WeakMap<Term, TermFacts>();

const factsOf = (term: Term): TermFacts => {
  const cached = factsCache.get(term);
  if (cached) return cached;
  const fresh: TermFacts = {};
  factsCache.set(term, fresh);
  return fresh;
};

/** An atom's key without building the term — the read side of `termKey` for callers holding a symbol. */
export const atomKey = (symbol: string): string => `atom:${symbol}`;

/** Canonical structural key for a term — the single identity used for maps, memoization, and link ids. */
export const termKey = (term: Term): string => {
  const facts = factsOf(term);
  if (facts.key !== undefined) return facts.key;
  const key = isAtomic(term)
    ? atomKey(term.symbol)
    : `${term.kind}:${getArgs(term).map(termKey).join(',')}`;
  facts.key = key;
  return key;
};

/** Every atomic symbol mentioned anywhere in the term. */
export const atomicSymbols = (term: Term): ReadonlySet<string> => {
  const facts = factsOf(term);
  if (facts.symbols) return facts.symbols;
  const symbols = new Set<string>();
  walkTerms(term, (t) => {
    if (isAtomic(t)) symbols.add(t.symbol);
  });
  facts.symbols = symbols;
  return symbols;
};

/**
 * `termKey` of every node in the term's subtree, the root included.
 * `termKey` equality is structural equality — two terms with the same key agree
 * on kind, arity and every argument recursively — so membership here is exactly
 * "this term occurs somewhere in the other".
 */
const subtermKeys = (term: Term): ReadonlySet<string> => {
  const facts = factsOf(term);
  if (facts.subterms) return facts.subterms;
  const keys = new Set<string>();
  walkTerms(term, (t) => {
    keys.add(termKey(t));
  });
  facts.subterms = keys;
  return keys;
};

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
export const bareInheritancePair = (term: Term): BareInheritance | null => {
  const facts = factsOf(term);
  if (facts.pair !== undefined) return facts.pair;

  let found: BareInheritance | null = null;
  walkTerms(term, (t) => {
    if (found || t.kind !== 'inheritance') return;
    const [subject, predicate] = t.args ?? [];
    if (subject?.kind === 'atom' && predicate?.kind === 'atom') {
      found = { subject: subject.symbol, predicate: predicate.symbol };
    }
  });

  facts.pair = found;
  return found;
};

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
