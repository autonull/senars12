/**
 * Term types and operators
 * Defines the structure of terms in NARS12
 */

import {computeHash} from '../utils';
import {TermBuilder} from './factory.js';
import {termParser} from './parser.js';

export const OPERATORS = {
    inheritance: '-->',
    similarity: '<->',
    conjunction: '&',
    disjunction: '|',
    negation: '--',
    implication: '=>',
    equivalence: '<=>'
} as const;

export type OperatorKey = keyof typeof OPERATORS;
export type OperatorSymbol = typeof OPERATORS[OperatorKey];

export interface AtomicTerm {
    readonly kind: 'atom';
    readonly symbol: string;
    readonly hash: number;
    readonly isVariable?: boolean;

    toString(): string;
}

export interface CompoundTerm {
    readonly kind: OperatorKey;
    readonly args: Term[];
    readonly hash: number;

    toString(): string;
}

export type Term = AtomicTerm | CompoundTerm;
export type TermMap = Map<number, Term>;

// Re-export hash utilities
export {computeHash};

// Term type guards
export const isVariableSymbol = (symbol: string): boolean => symbol.startsWith('$');
export const isAtomic = (term: Term): term is AtomicTerm => term.kind === 'atom';
export const isCompound = (term: Term): term is CompoundTerm => term.kind !== 'atom';

// Term accessors
export const getTermArgs = (term: Term): Term[] =>
    term.kind === 'atom' ? [] : term.args;

export const getTermArg = (term: Term, index: number): Term | undefined =>
    term.kind === 'atom' ? undefined : term.args[index];

// Atom constructor (re-export from factory for caching)
export const atom = TermBuilder.atom;

// Term serialization
const serialize = (term: Term): string => {
    switch (term.kind) {
        case 'atom':
            return term.symbol;
        case 'inheritance':
        case 'similarity': {
            const [sub, pred] = term.args;
            if (!sub || !pred) return '';
            const op = OPERATORS[term.kind];
            return `(${serialize(sub)} ${op} ${serialize(pred)})`;
        }
        case 'conjunction':
            return term.args.length === 0
                ? 'TRUE'
                : `(${term.args.map(serialize).join(' & ')})`;
        case 'disjunction':
            return `(${term.args.map(serialize).join(' | ')})`;
        case 'negation': {
            const arg = term.args[0];
            if (!arg) return '';
            return `(--${serialize(arg)})`;
        }
        case 'implication':
        case 'equivalence': {
            const [a, c] = term.args;
            if (!a || !c) return '';
            const op = OPERATORS[term.kind];
            return `(${serialize(a)} ${op} ${serialize(c)})`;
        }
        default:
            return 'args' in term && Array.isArray((term as any).args)
                ? `(${(term as any).args.map(serialize).join(', ')})`
                : '';
    }
};

export {serialize as serializeTerm};

export const deserializeTerm = (s: string): Term | null => {
    try {
        return termParser.parse(s);
    } catch {
        return null;
    }
};

export const getTermComplexity = (term: Term): {
    depth: number;
    breadth: number;
    operatorCount: number;
    variableCount: number;
} => {
    let maxDepth = 0;
    let breadth = 0;
    let operatorCount = 0;
    let variableCount = 0;

    const traverse = (t: Term, depth: number): void => {
        maxDepth = Math.max(maxDepth, depth);
        if (t.kind === 'atom') {
            if (t.isVariable) variableCount++;
        } else {
            operatorCount++;
            breadth = Math.max(breadth, t.args.length);
            for (const arg of t.args) {
                traverse(arg, depth + 1);
            }
        }
    };

    traverse(term, 0);
    return {depth: maxDepth, breadth, operatorCount, variableCount};
};

export const getTermSimilarity = (t1: Term, t2: Term): number => {
    if (t1.hash === t2.hash) return 1.0;

    const complexity1 = getTermComplexity(t1);
    const complexity2 = getTermComplexity(t2);

    const depthSim = 1 - Math.abs(complexity1.depth - complexity2.depth) / Math.max(complexity1.depth, complexity2.depth, 1);
    const breadthSim = 1 - Math.abs(complexity1.breadth - complexity2.breadth) / Math.max(complexity1.breadth, complexity2.breadth, 1);
    const operatorSim = 1 - Math.abs(complexity1.operatorCount - complexity2.operatorCount) / Math.max(complexity1.operatorCount, complexity2.operatorCount, 1);

    const structuralSim = (depthSim + breadthSim + operatorSim) / 3;

    const t1Str = serialize(t1);
    const t2Str = serialize(t2);
    const tokens1 = new Set(t1Str.split(/[\s(),]+/).filter(Boolean));
    const tokens2 = new Set(t2Str.split(/[\s(),]+/).filter(Boolean));
    const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
    const union = new Set([...tokens1, ...tokens2]);
    const jaccard = union.size > 0 ? intersection.size / union.size : 0;

    return (structuralSim + jaccard) / 2;
};

export const substituteVariables = (term: Term, bindings: Map<string, Term>): Term => {
    if (term.kind === 'atom') {
        if (term.isVariable && bindings.has(term.symbol)) {
            return bindings.get(term.symbol)!;
        }
        return term;
    }

    const newArgs = term.args.map(arg => substituteVariables(arg, bindings));
    return TermBuilder.compound(term.kind, newArgs);
};

export const improveNormalization = (term: Term): Term => {
    if (term.kind === 'atom') {
        return term;
    }

    if (term.kind === 'conjunction' || term.kind === 'disjunction') {
        const sortedArgs = [...term.args].sort((a, b) => {
            const hashA = a.kind === 'atom' ? a.symbol : String(a.kind);
            const hashB = b.kind === 'atom' ? b.symbol : String(b.kind);
            return hashA.localeCompare(hashB);
        });

        let result = TermBuilder.compound(term.kind, sortedArgs);
        for (let i = 0; i < sortedArgs.length - 1; i++) {
            result = TermBuilder.compound(term.kind, [result, sortedArgs[i + 1]!]);
        }
        return result;
    }

    return term;
};
