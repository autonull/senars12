export type OperatorKey = 'inheritance' | 'similarity' | 'conjunction' | 'disjunction' | 'negation' | 'implication' | 'equivalence';

export const OPERATORS = {
    inheritance: '-->',
    similarity: '<->',
    conjunction: '&',
    disjunction: '|',
    negation: '~',
    implication: '=>',
    equivalence: '<=>'
} as const;

export type Operator = keyof typeof OPERATORS;
export type OperatorSymbol = typeof OPERATORS[Operator];

function fnv1a(str: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

function fnv1aCombine(acc: number, val: number): number {
    let h = Math.imul(acc ^ val, 0x01000193);
    return h >>> 0;
}

export { fnv1a, fnv1aCombine };

export interface AtomicTerm {
    readonly kind: 'atom';
    readonly symbol: string;
    readonly hash: number;
}

export interface CompoundTerm {
    readonly kind: OperatorKey;
    readonly args: Term[];
    readonly hash: number;
}

export type Term = AtomicTerm | CompoundTerm;

export type TermMap = Map<number, Term>;

export function computeHash(kind: string, argHashes: number[]): number {
    const opHash = fnv1a(kind);
    const sorted = [...argHashes].sort((a, b) => a - b);
    return sorted.reduce((acc, h) => fnv1aCombine(acc, h), opHash);
}

export function atom(symbol: string): AtomicTerm {
    return Object.freeze({ kind: 'atom' as const, symbol, hash: fnv1a(symbol) });
}

export function isAtomic(term: Term): term is AtomicTerm {
    return term.kind === 'atom';
}

export function getTermArgs(term: Term): Term[] {
    return term.kind === 'atom' ? [] : term.args;
}

export function getTermArg(term: Term, index: number): Term | undefined {
    if (term.kind === 'atom') return undefined;
    return term.args[index];
}

export function termsEqual(a: Term, b: Term): boolean {
    return a.hash === b.hash;
}

function serializeTermInternal(term: Term): string {
    switch (term.kind) {
        case 'atom':
            return term.symbol;
        case 'inheritance': {
            const sub = term.args[0];
            const pred = term.args[1];
            return sub && pred ? `(${serializeTermInternal(sub)} --> ${serializeTermInternal(pred)})` : '';
        }
        case 'similarity': {
            const sub = term.args[0];
            const pred = term.args[1];
            return sub && pred ? `(${serializeTermInternal(sub)} <-> ${serializeTermInternal(pred)})` : '';
        }
        case 'conjunction':
            return term.args.length === 0 ? 'TRUE' : `(${term.args.map(serializeTermInternal).join(' & ')})`;
        case 'disjunction':
            return `(${term.args.map(serializeTermInternal).join(' | ')})`;
        case 'negation': {
            const arg = term.args[0];
            return arg ? `~${serializeTermInternal(arg)}` : '';
        }
        case 'implication': {
            const ant = term.args[0];
            const cons = term.args[1];
            return ant && cons ? `(${serializeTermInternal(ant)} => ${serializeTermInternal(cons)})` : '';
        }
        case 'equivalence': {
            const a = term.args[0];
            const c = term.args[1];
            return a && c ? `(${serializeTermInternal(a)} <=> ${serializeTermInternal(c)})` : '';
        }
    }
}

export { serializeTermInternal as serializeTerm };