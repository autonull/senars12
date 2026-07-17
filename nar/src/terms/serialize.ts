import { createLogger } from '../logger/index.js';
import { OPERATORS } from './operators.js';
import { termParser } from './parser-peggy.js';
import type { Term } from './types.js';

const log = createLogger({ scope: 'serialize' });

const NARY_OPS_SET = new Set(
  Object.entries(OPERATORS)
    .filter(([, v]) => v.nary)
    .map(([k]) => k)
);
const BINARY_OPS = new Set(
  Object.entries(OPERATORS)
    .filter(([, v]) => v.arity === 2 && !v.nary)
    .map(([k]) => k)
);
const UNARY_OPS = new Set(
  Object.entries(OPERATORS)
    .filter(([, v]) => v.arity === 1)
    .map(([k]) => k)
);

const WRAPPERS: Record<string, [string, string]> = {
  negation: ['--', ')'],
  instance: ['{', '}'],
  property: ['[', ']'],
};

const NARY_SEPARATORS: Record<string, string> = {
  conjunction: ' & ',
  disjunction: ' | ',
  sequence: ' ,/ ',
  parallel: ' || ',
};

const serialize = (term: Term): string => {
  if (term.kind === 'atom') return term.symbol;

  const serializeArgs = (args: readonly Term[]): string =>
    args.map((a: Term) => serialize(a)).join(', ');

  if (NARY_OPS_SET.has(term.kind)) {
    const args = term.args ?? ([] as readonly Term[]);
    const sep = NARY_SEPARATORS[term.kind] ?? ', ';
    if (args.length === 0)
      return term.kind === 'conjunction' ? 'TRUE' : term.kind === 'disjunction' ? 'FALSE' : '';
    if (args.length === 1) return serialize(args[0] as Term);
    return `(${args.map((a: Term) => serialize(a)).join(sep)})`;
  }

  if (BINARY_OPS.has(term.kind)) {
    const [a, b] = term.args ?? ([] as readonly Term[]);
    const op = OPERATORS[term.kind]?.symbol ?? '';
    return a && b ? `(${serialize(a as Term)} ${op} ${serialize(b as Term)})` : '';
  }

  if (UNARY_OPS.has(term.kind)) {
    const args = term.args ?? ([] as readonly Term[]);
    const [prefix, suffix] = WRAPPERS[term.kind] ?? ['', ''];
    if (args.length === 0) return '';
    return args.length === 1
      ? `${prefix}${serialize(args[0] as Term)}${suffix}`
      : `${prefix}${serializeArgs(args)}${suffix}`;
  }

  const t = term as { args?: readonly Term[] };
  return t.args ? `(${serializeArgs(t.args)})` : '';
};

export const serializeTerm = serialize;

export const deserializeTerm = (s: string): Term | null => {
  try {
    return termParser.parse(s);
  } catch (e) {
    log.error('Deserialize failed', e as Error);
    return null;
  }
};
