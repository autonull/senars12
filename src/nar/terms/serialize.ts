import type {Term} from './types.js';
import {OPERATORS} from './operators.js';
import {termParser} from './parser.js';

const serialize = (term: Term): string => {
    switch (term.kind) {
        case 'atom':
            return term.symbol;
        case 'inheritance':
        case 'similarity': {
            const [sub, pred] = term.args ?? [];
            if (!sub || !pred) return '';
            const op = OPERATORS[term.kind]?.symbol;
            if (!op) return '';
            return `(${serialize(sub)} ${op} ${serialize(pred)})`;
        }
        case 'conjunction':
            return (term.args ?? []).length === 0
                ? 'TRUE'
                : `(${term.args.map(serialize).join(' & ')})`;
        case 'disjunction':
            return `(${(term.args ?? []).map(serialize).join(' | ')})`;
        case 'negation': {
            const arg = term.args?.[0];
            if (!arg) return '';
            return `(--${serialize(arg)})`;
        }
        case 'implication':
        case 'equivalence': {
            const [a, c] = term.args ?? [];
            if (!a || !c) return '';
            const op = OPERATORS[term.kind]?.symbol;
            if (!op) return '';
            return `(${serialize(a)} ${op} ${serialize(c)})`;
        }
        case 'instance': {
            const arg = term.args?.[0];
            if (!arg) return '';
            return `{${serialize(arg)}}`;
        }
        case 'property': {
            const arg = term.args?.[0];
            if (!arg) return '';
            return `[${serialize(arg)}]`;
        }
        case 'sequence': {
            const [a, b] = term.args ?? [];
            if (!a || !b) return '';
            return `(${serialize(a)} ,/ ${serialize(b)})`;
        }
        case 'parallel': {
            const [a, b] = term.args ?? [];
            if (!a || !b) return '';
            return `(${serialize(a)} || ${serialize(b)})`;
        }
        case 'predictive': {
            const [a, b] = term.args ?? [];
            if (!a || !b) return '';
            return `(${serialize(a)} /> ${serialize(b)})`;
        }
        case 'retrospective': {
            const [a, b] = term.args ?? [];
            if (!a || !b) return '';
            return `(${serialize(a)} /< ${serialize(b)})`;
        }
        case 'operation': {
            const [op, input] = term.args ?? [];
            if (!op || !input) return '';
            return `(${serialize(op)} ^ ${serialize(input)})`;
        }
        default: {
            const t = term as { args?: readonly Term[] };
            return t.args
                ? `(${t.args.map(serialize).join(', ')})`
                : '';
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
