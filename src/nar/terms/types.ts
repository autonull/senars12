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

const fnv1a = (str: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const fnv1aCombine = (acc: number, val: number): number =>
  Math.imul(acc ^ val, 0x01000193) >>> 0;

export interface AtomicTerm {
  readonly kind: 'atom';
  readonly symbol: string;
  readonly hash: number;
  readonly isVariable?: boolean;
}

export interface CompoundTerm {
  readonly kind: OperatorKey;
  readonly args: Term[];
  readonly hash: number;
}

export type Term = AtomicTerm | CompoundTerm;
export type TermMap = Map<number, Term>;

export const computeHash = (kind: string, argHashes: number[]): number => {
  const opHash = fnv1a(kind);
  const sorted = [...argHashes].sort((a, b) => a - b);
  return sorted.reduce((acc, h) => fnv1aCombine(acc, h), opHash);
};

export const isVariableSymbol = (symbol: string): boolean => symbol.startsWith('$');
export const isAtomic = (term: Term): term is AtomicTerm => term.kind === 'atom';
export const getTermArgs = (term: Term): Term[] =>
  term.kind === 'atom' ? [] : term.args;
export const getTermArg = (term: Term, index: number): Term | undefined =>
  term.kind === 'atom' ? undefined : term.args[index];
export const termsEqual = (a: Term, b: Term): boolean => a.hash === b.hash;

export const atom = (symbol: string): AtomicTerm =>
  Object.freeze({ kind: 'atom' as const, symbol, hash: fnv1a(symbol) });

export { fnv1a, fnv1aCombine };

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

export { serialize as serializeTerm };
