import { LruCache } from '@senars/util';
import { COMMUTATIVE_OPS, NARY_OPS, OPERATORS } from '../operators.js';
import type { AtomicTerm, CompoundTerm, OperatorKey, Term } from '../types.js';
import { VARIABLE_SYMBOL } from '../types.js';
import { atomKey, termKey } from './accessors.js';
import { serializeTerm } from './serialize.js';
import { INVALID_ATOM_CHARS_REGEX } from './valid-atom.js';

const TERM_CACHE_MAX_SIZE = 10000;

const termCache = new LruCache<string, Term>(TERM_CACHE_MAX_SIZE);

const cache = <T extends Term>(term: T, key: string): T => {
  termCache.set(key, term);
  return term;
};

const createAtom = (symbol: string): AtomicTerm => {
  if (symbol.includes(':')) {
    throw new Error(
      `Atomic term symbol cannot contain ':' (Narsese compact inheritance shorthand). Use '_' instead, or use the parser for namespaced terms like 'ns:term'.`
    );
  }
  const isVariable = VARIABLE_SYMBOL.test(symbol);
  const isQuotedAtom = symbol.startsWith('"') && symbol.endsWith('"');
  if (!isVariable && !isQuotedAtom && INVALID_ATOM_CHARS_REGEX.test(symbol)) {
    const badChar = symbol.match(INVALID_ATOM_CHARS_REGEX)?.[0];
    throw new Error(
      `Atomic term symbol cannot contain '${badChar}' (reserved in Narsese grammar). ` +
        `Use '_' instead.`
    );
  }
  const key = atomKey(symbol);
  const cached = termCache.get(key);
  if (cached) return cached as AtomicTerm;
  return cache(
    Object.freeze({
      kind: 'atom' as const,
      symbol,
      isVariable,
      toString() {
        return symbol;
      },
    } as AtomicTerm),
    key
  );
};

const TRUE_ATOM = createAtom('TRUE');
const FALSE_ATOM = createAtom('FALSE');
const NULL_ATOM = createAtom('NULL');

export const atomOf = (symbol: string): AtomicTerm =>
  symbol === 'TRUE' ? TRUE_ATOM : symbol === 'FALSE' ? FALSE_ATOM : symbol === 'NULL' ? NULL_ATOM : createAtom(symbol);

export const isBoolAtom = (term: Term): boolean =>
  term.kind === 'atom' && (term.symbol === 'TRUE' || term.symbol === 'FALSE' || term.symbol === 'NULL');

/** Module-scope collator: identical ordering to `localeCompare` without its per-call ICU setup. */
const CANONICAL_COLLATOR = new Intl.Collator();
const canonicalKeyOf = (t: Term): string => (t.kind === 'atom' ? t.symbol : t.kind);
const canonicalOrder = (a: Term, b: Term): number =>
  CANONICAL_COLLATOR.compare(canonicalKeyOf(a), canonicalKeyOf(b));

/**
 * The interning constructor, deliberately **raw**: it sorts, collapses and keys,
 * and it does not canonicalise. Canonicalisation lives one level up in
 * `factory.ts`, so a reducer can rebuild its own output here without re-entering
 * the reducer pipeline — a cycle the fixpoint in `canonicalTerm` cannot survive.
 */
export const compoundOf = (kind: OperatorKey, args: Term[]): Term => {
  const valid = args.filter(Boolean);
  // Empty: only disjunction folds to FALSE; conjunction and product are real terms
  if (valid.length === 0) {
    if (kind === 'disjunction') return FALSE_ATOM;
    // conjunction and product with 0 args are valid distinct terms
  }
  // Single argument: folds for disjunction, conjunction, parallel (n-ary kinds).
  // Sequence is binary in SeNARS (arity=2) — throws on wrong arity.
  // Product is GTEZero — 1-member is a real term, not a fold.
  if (valid.length === 1) {
    if (kind === 'disjunction' || kind === 'conjunction' || kind === 'parallel') return valid[0]!;
  }

  // Negation requires exactly 1 argument — reference throws on wrong arity
  if (kind === 'negation' && valid.length !== 1) {
    throw new Error(`Negation requires exactly 1 argument, got ${valid.length}`);
  }

  // Sequence is binary in SeNARS — reference throws on wrong arity
  if (kind === 'sequence' && valid.length !== 2) {
    throw new Error(`Sequence requires exactly 2 arguments, got ${valid.length}`);
  }

  // Operation requires exactly 2 arguments — reference throws on wrong arity
  if (kind === 'operation' && valid.length !== 2) {
    throw new Error(`Operation requires exactly 2 arguments, got ${valid.length}`);
  }
  // Operation requires its second argument to be a product (per Narsese grammar).
  // If caller passed a bare term, wrap it. This ensures round-trip identity.
  if (kind === 'operation' && valid.length === 2 && valid[1]?.kind !== 'product') {
    valid[1] = compoundOf('product', [valid[1]!]);
  }

  const sorted = COMMUTATIVE_OPS.has(kind) ? valid.toSorted(canonicalOrder) : valid;

  // `termKey` is the canonical structural key — prefixing every atom makes the
  // derivation injective, where joining bare `toString()` forms let any symbol
  // containing `,` alias a different arity.
  const shape = { kind, args: sorted } as CompoundTerm;
  const key = termKey(shape);
  const cached = termCache.get(key);
  if (cached) return cached;

  // Compute serialized form once during creation (cache key is NOT the full serialized form)
  const serialized = serializeTerm(shape);

  return cache(
    Object.freeze({
      kind,
      args: sorted as readonly Term[],
      _serialized: serialized,
      toString() {
        return (this as any)._serialized ?? serializeTerm(this as CompoundTerm);
      },
    } as CompoundTerm & { _serialized?: string }),
    key
  );
};

const compoundCtors = {} as Record<OperatorKey, (...args: Term[]) => Term>;
for (const key of Object.keys(OPERATORS) as OperatorKey[]) {
  compoundCtors[key] = (...args: Term[]) => compoundOf(key, args);
}

export const rawCompoundCtors = compoundCtors;

export const evictTerm = (key: string): boolean => termCache.delete(key);
export const clearTerms = (): void => termCache.clear();
export const termCacheSize = (): number => termCache.size();
