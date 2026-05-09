import type {AtomicTerm, CompoundTerm, Term} from './types.js';
import {serializeTerm} from './types.js';
import {computeHash, fnv1a} from '../utils';

const termCache = new Map<number, Term>();

const cache = <T extends Term>(term: T): T => {
    termCache.set(term.hash, term);
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
        toString() { return symbol; }
    } as AtomicTerm));
};

const createCompound = (kind: CompoundTerm['kind'], args: Term[], sort?: boolean): Term => {
    const valid = args.filter(Boolean);
    if (valid.length === 0) return kind === 'disjunction' ? createAtom('FALSE') : createAtom('TRUE');
    const sorted = sort ? valid.toSorted((a, b) => a.hash - b.hash) : valid;
    const hash = computeHash(kind, sorted.map(t => t.hash));
    const cached = termCache.get(hash);
    if (cached) return cached;
    return cache(Object.freeze({
        kind,
        args: sorted,
        hash,
        toString() { return serializeTerm(this as CompoundTerm); }
    } as CompoundTerm));
};

const TRUE_ATOM = createAtom('TRUE');
const FALSE_ATOM = createAtom('FALSE');

export const TermBuilder = {
    atom: (symbol: string): AtomicTerm => symbol === 'TRUE' ? TRUE_ATOM : symbol === 'FALSE' ? FALSE_ATOM : createAtom(symbol),

    inheritance: (s: Term | undefined, p: Term | undefined): Term =>
        s && p ? createCompound('inheritance', [s, p]) : createAtom('TRUE'),

    similarity: (s: Term | undefined, p: Term | undefined): Term =>
        s && p ? createCompound('similarity', [s, p]) : createAtom('TRUE'),

    conjunction: (...terms: (Term | undefined)[]): Term => createCompound('conjunction', terms, true),

    disjunction: (...terms: (Term | undefined)[]): Term => createCompound('disjunction', terms, true),

    negation: (term: Term | undefined): Term => term ? createCompound('negation', [term]) : createAtom('TRUE'),

    implication: (ant: Term | undefined, cons: Term | undefined): Term =>
        ant && cons ? createCompound('implication', [ant, cons]) : createAtom('TRUE'),

    equivalence: (a: Term | undefined, c: Term | undefined): Term =>
        a && c ? createCompound('equivalence', [a, c]) : createAtom('TRUE'),

    compound: (kind: CompoundTerm['kind'], args: Term[]): Term => createCompound(kind, args),

    evict: (hash: number): boolean => termCache.delete(hash),
    clear: (): void => termCache.clear(),
    get size(): number { return termCache.size; }
};

export const freeze = <T extends object>(obj: T): Readonly<T> => Object.freeze(obj);
export const TermFactory = TermBuilder;