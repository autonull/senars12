import type { Term, CompoundTerm } from './types.js';

export type Substitution = Record<string, Term>;

const isVariable = (symbol: string): boolean => symbol.startsWith('$');
const isCompound = (term: Term): term is CompoundTerm => term.kind !== 'atom';

export function unify(a: Term, b: Term, subst: Substitution = {}): Substitution | undefined {
  if (a.kind === 'atom' && isVariable(a.symbol)) {
    const bound = subst[a.symbol];
    if (!bound) return { ...subst, [a.symbol]: b };
    return bound.hash === b.hash ? subst : undefined;
  }
  if (b.kind === 'atom' && isVariable(b.symbol)) {
    const bound = subst[b.symbol];
    if (!bound) return { ...subst, [b.symbol]: a };
    return bound.hash === a.hash ? subst : undefined;
  }
  if (a.kind === 'atom' && b.kind === 'atom') return a.symbol === b.symbol ? subst : undefined;
  if (!isCompound(a) || !isCompound(b) || a.kind !== b.kind || a.args.length !== b.args.length) return undefined;

  let s: Substitution | undefined = subst;
  for (let i = 0; i < a.args.length; i++) {
    const next = a.args[i];
    const nextB = b.args[i];
    if (!next || !nextB) return undefined;
    s = unify(next, nextB, s ?? {});
    if (!s) return undefined;
  }
  return s ?? subst;
}
