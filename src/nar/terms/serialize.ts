import type {Term} from './types.js';
import {OPERATORS} from './operators.js';
import {termParser} from './parser-peggy.js';

const BINARY_OPS = new Set(Object.entries(OPERATORS).filter(([, v]) => v.arity === 2 || v.nary).map(([k]) => k));
const UNARY_OPS = new Set(Object.entries(OPERATORS).filter(([, v]) => v.arity === 1).map(([k]) => k));

const WRAPPERS: Record<string, [string, string]> = {
    negation: ['--', ')'], instance: ['{', '}'], property: ['[', ']']
};

const serialize = (term: Term): string => {
    if (term.kind === 'atom') return term.symbol;

    if (BINARY_OPS.has(term.kind)) {
        const [a, b] = term.args ?? [];
        const op = OPERATORS[term.kind]?.symbol ?? '';
        return a && b ? `(${serialize(a)} ${op} ${serialize(b)})` : '';
    }

    if (UNARY_OPS.has(term.kind)) {
        const arg = term.args?.[0];
        const [prefix, suffix] = WRAPPERS[term.kind] ?? ['', ''];
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
    } catch (e) {
        console.error('Deserialize failed:', e);
        return null;
    }
};
