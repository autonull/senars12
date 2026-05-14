import type {Term} from './types.js';
import {OPERATORS} from './operators.js';
import {termParser} from './parser.js';

const serializeBinaryOp = (term: Term, op: string): string => {
    const [a, b] = term.args ?? [];
    return a && b ? `(${serialize(a)} ${op} ${serialize(b)})` : '';
};

const serializeUnaryOp = (term: Term, prefix: string, suffix = ''): string => {
    const arg = term.args?.[0];
    return arg ? `${prefix}${serialize(arg)}${suffix}` : '';
};

const serialize = (term: Term): string => {
    switch (term.kind) {
        case 'atom':
            return term.symbol;
        case 'inheritance':
        case 'similarity':
            return serializeBinaryOp(term, OPERATORS[term.kind]?.symbol ?? '');
        case 'conjunction':
            return (term.args ?? []).length === 0
                ? 'TRUE'
                : `(${term.args.map(serialize).join(' & ')})`;
        case 'disjunction':
            return `(${(term.args ?? []).map(serialize).join(' | ')})`;
        case 'negation':
            return serializeUnaryOp(term, '--', ')');
        case 'implication':
        case 'equivalence':
            return serializeBinaryOp(term, OPERATORS[term.kind]?.symbol ?? '');
        case 'instance':
            return serializeUnaryOp(term, '{', '}');
        case 'property':
            return serializeUnaryOp(term, '[', ']');
        case 'sequence':
            return serializeBinaryOp(term, ',/');
        case 'parallel':
            return serializeBinaryOp(term, '||');
        case 'predictive':
            return serializeBinaryOp(term, '/>');
        case 'retrospective':
            return serializeBinaryOp(term, '/<');
        case 'operation':
            return serializeBinaryOp(term, '^');
        default: {
            const t = term as { args?: readonly Term[] };
            return t.args ? `(${t.args.map(serialize).join(', ')})` : '';
        }
    }
};

export const serializeTerm = serialize;

export const deserializeTerm = (s: string): Term | null => {
    try {
        return termParser.parse(s);
    } catch {
        return null;
    }
};