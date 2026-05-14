import type {Term} from './types.js';
import {OPERATORS} from './operators.js';
import {termParser} from './parser.js';

const binaryOps = ['inheritance', 'similarity', 'implication', 'equivalence', 'sequence', 'parallel', 'predictive', 'retrospective', 'operation'] as const;
const unaryOps = ['negation', 'instance', 'property'] as const;

const serialize = (term: Term): string => {
    if (term.kind === 'atom') return term.symbol;

    if (binaryOps.includes(term.kind as typeof binaryOps[number])) {
        const [a, b] = term.args ?? [];
        const op = OPERATORS[term.kind]?.symbol ?? '';
        return a && b ? `(${serialize(a)} ${op} ${serialize(b)})` : '';
    }

    if (unaryOps.includes(term.kind as typeof unaryOps[number])) {
        const arg = term.args?.[0];
        const [prefix, suffix] = term.kind === 'negation' ? ['--', ')'] : term.kind === 'instance' ? ['{', '}'] : ['[', ']'];
        return arg ? `${prefix}${serialize(arg)}${suffix}` : '';
    }

    if (term.kind === 'conjunction') {
        const args = term.args ?? [];
        return args.length === 0 ? 'TRUE' : `(${args.map(serialize).join(' & ')})`;
    }

    if (term.kind === 'disjunction') {
        return `(${(term.args ?? []).map(serialize).join(' | ')})`;
    }

    const t = term as { args?: readonly Term[] };
    return t.args ? `(${t.args.map(serialize).join(', ')})` : '';
};

export const serializeTerm = serialize;

export const deserializeTerm = (s: string): Term | null => {
    try {
        return termParser.parse(s);
    } catch {
        return null;
    }
};