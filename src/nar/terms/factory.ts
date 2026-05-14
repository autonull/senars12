import type {AtomicTerm, CompoundTerm, OperatorKey, Term} from './types.js';
import {serializeTerm} from './serialize.js';
import {COMMUTATIVE_OPS, OPERATORS} from './operators.js';
import {trackTerm} from '../memory';

const TERM_CACHE_MAX_SIZE = 10000;

const termCache = new Map<string, Term>();

let trackTermReady = false;

const cache = <T extends Term>(term: T, key: string): T => {
    if (termCache.size >= TERM_CACHE_MAX_SIZE && !termCache.has(key)) {
        const first = termCache.keys().next();
        if (first.value) termCache.delete(first.value);
    }
    termCache.set(key, term);
    if (trackTermReady) trackTerm(term);
    return term;
};

const createAtom = (symbol: string): AtomicTerm => {
    const key = `atom:${symbol}`;
    const cached = termCache.get(key);
    if (cached) return cached as AtomicTerm;
    return cache(Object.freeze({
        kind: 'atom' as const,
        symbol,
        isVariable: symbol.startsWith('$'),
        toString() { return symbol; }
    } as AtomicTerm), key);
};

const TRUE_ATOM = createAtom('TRUE');
const FALSE_ATOM = createAtom('FALSE');

trackTermReady = true;

const createCompound = (kind: OperatorKey, args: Term[]): Term => {
    const valid = args.filter(Boolean);
    if (valid.length === 0) return kind === 'disjunction' ? FALSE_ATOM : TRUE_ATOM;

    const sorted = COMMUTATIVE_OPS.has(kind)
        ? valid.toSorted((a, b) => (a.kind === 'atom' ? a.symbol : a.kind).localeCompare(b.kind === 'atom' ? b.symbol : b.kind))
        : valid;

    const key = `${kind}:${sorted.map(a => a.kind === 'atom' ? `atom:${a.symbol}` : a.kind).join(',')}`;
    const cached = termCache.get(key);
    if (cached) return cached;

    return cache(Object.freeze({
        kind,
        args: sorted as readonly Term[],
        toString() { return serializeTerm(this as CompoundTerm); }
    } as CompoundTerm), key);
};

const compoundCtors = {} as Record<OperatorKey, (...args: Term[]) => Term>;
for (const key of Object.keys(OPERATORS) as OperatorKey[]) {
    compoundCtors[key] = (...args: Term[]) => createCompound(key, args);
}

export const TermBuilder = {
    atom: (symbol: string): AtomicTerm =>
        symbol === 'TRUE' ? TRUE_ATOM : symbol === 'FALSE' ? FALSE_ATOM : createAtom(symbol),

    ...compoundCtors as Record<OperatorKey, (...args: Term[]) => Term>,

    compound: (kind: OperatorKey, args: Term[]): Term => createCompound(kind, args),

    evict: (key: string): boolean => termCache.delete(key),
    clear: (): void => termCache.clear(),
    get size(): number { return termCache.size; }
};

export const freeze = <T extends object>(obj: T): Readonly<T> => Object.freeze(obj);
export const TermFactory = TermBuilder;
export const atom = TermBuilder.atom;
