import type {AtomicTerm, CompoundTerm, OperatorKey, Term} from './types.js';
import {serializeTerm} from './serialize.js';
import {COMMUTATIVE_OPS, OPERATORS} from './operators.js';
import {computeHash, fnv1a} from '../utils';
import {trackTerm} from '../memory';

const TERM_CACHE_MAX_SIZE = 10000;

const termCache = new Map<number, Term>();
let cacheOrder: number[] = [];

let trackTermReady = false;

const cache = <T extends Term>(term: T): T => {
if (termCache.size >= TERM_CACHE_MAX_SIZE && !termCache.has(term.hash)) {
const oldestHash = cacheOrder.shift();
if (oldestHash !== undefined) {
termCache.delete(oldestHash);
}
}
termCache.set(term.hash, term);
cacheOrder.push(term.hash);
if (trackTermReady) {
trackTerm(term);
}
return term;
};

const createAtom = (symbol: string): AtomicTerm => {
    const hash = fnv1a(symbol);
    const cached = termCache.get(hash);
    if (cached) return cached as AtomicTerm;
    return cache(Object.freeze({
        kind: 'atom' as const,
        symbol,
        hash,
        isVariable: symbol.startsWith('$'),
        toString() {
            return symbol;
        }
    } as AtomicTerm));
};

const TRUE_ATOM = createAtom('TRUE');
const FALSE_ATOM = createAtom('FALSE');

trackTermReady = true;

const createCompound = (kind: OperatorKey, args: Term[]): Term => {
    const valid = args.filter(Boolean);
    if (valid.length === 0) return kind === 'disjunction' ? FALSE_ATOM : TRUE_ATOM;
    const sorted = COMMUTATIVE_OPS.has(kind) ? valid.toSorted((a, b) => a.hash - b.hash) : valid;
    const hash = computeHash(kind, sorted.map(t => t.hash));
    const cached = termCache.get(hash);
    if (cached) return cached;
    return cache(Object.freeze({
        kind,
        args: sorted as readonly Term[],
        hash,
        toString() {
            return serializeTerm(this as CompoundTerm);
        }
    } as CompoundTerm));
};

const compoundCtors = {} as Record<OperatorKey, (...args: Term[]) => Term>;
for (const key of Object.keys(OPERATORS) as OperatorKey[]) {
    compoundCtors[key] = (...args: Term[]) => createCompound(key, args);
}

export const TermBuilder = {
    atom: (symbol: string): AtomicTerm => symbol === 'TRUE' ? TRUE_ATOM : symbol === 'FALSE' ? FALSE_ATOM : createAtom(symbol),

    ...compoundCtors as Record<OperatorKey, (...args: Term[]) => Term>,

    inheritance: (s: Term, p: Term): Term => createCompound('inheritance', [s, p]),
    similarity: (s: Term, p: Term): Term => createCompound('similarity', [s, p]),
    implication: (a: Term, c: Term): Term => createCompound('implication', [a, c]),
    equivalence: (a: Term, c: Term): Term => createCompound('equivalence', [a, c]),
    negation: (t: Term): Term => createCompound('negation', [t]),
    instance: (t: Term): Term => createCompound('instance', [t]),
    property: (t: Term): Term => createCompound('property', [t]),
    sequence: (a: Term, b: Term): Term => createCompound('sequence', [a, b]),
    parallel: (a: Term, b: Term): Term => createCompound('parallel', [a, b]),
    predictive: (a: Term, b: Term): Term => createCompound('predictive', [a, b]),
    retrospective: (a: Term, b: Term): Term => createCompound('retrospective', [a, b]),
    operation: (op: Term, input: Term): Term => createCompound('operation', [op, input]),

    compound: (kind: OperatorKey, args: Term[]): Term => createCompound(kind, args),

    evict: (hash: number): boolean => {
        const index = cacheOrder.indexOf(hash);
        if (index !== -1) cacheOrder.splice(index, 1);
        return termCache.delete(hash);
    },
    clear: (): void => {
        termCache.clear();
        cacheOrder = [];
    },
    get size(): number {
        return termCache.size;
    }
};

export const freeze = <T extends object>(obj: T): Readonly<T> => Object.freeze(obj);
export const TermFactory = TermBuilder;
export const atom = TermBuilder.atom;