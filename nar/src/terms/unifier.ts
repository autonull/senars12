import { LruCache } from '@senars/util';
import { termsEqual } from './accessors.js';
import type { Term } from './types.js';
import { isCompound, isVariableSymbol } from './types.js';

export type Substitution = Record<string, Term>;

export interface UnificationResult {
  success: boolean;
  substitution?: Substitution;
  error?: string;
}

const CACHE_MAX_SIZE = 1000;

/** Only top-level calls are cached: the key must capture the whole substitution. */
const cache = new LruCache<string, Substitution | null>(CACHE_MAX_SIZE);

const occursCheck = (variable: string, term: Term, subst: Substitution, depth = 0): boolean => {
  const bound = subst[variable];
  if (bound && depth < 64) return occursCheck(variable, bound, subst, depth + 1);
  if (term.kind === 'atom') return term.symbol === variable;
  for (const arg of term.args ?? []) {
    if (occursCheck(variable, arg, subst, depth + 1)) return true;
  }
  return false;
};

function termToKey(term: Term): string {
  if (term.kind === 'atom') return `a:${term.symbol}`;
  return `${term.kind}[${term.args?.map(termToKey).join(',') ?? ''}]`;
}

/** Memoization key — includes bound *values*, never just the bound variable names. */
function cacheKey(a: Term, b: Term, subst: Substitution, occurs: boolean): string {
  const bindings = Object.keys(subst)
    .sort()
    .map((v) => `${v}=${termToKey(subst[v] as Term)}`)
    .join(';');
  return `${occurs ? 1 : 0}|${termToKey(a)}|${termToKey(b)}|${bindings}`;
}

export function unify(
  a: Term,
  b: Term,
  subst: Substitution = {},
  enableOccursCheck = true
): Substitution | undefined {
  const key = cacheKey(a, b, subst, enableOccursCheck);
  const cached = cache.get(key);
  if (cached !== undefined) return cached ?? undefined;

  const result = unifyInner(a, b, subst, enableOccursCheck) ?? null;
  cache.set(key, result);
  return result ?? undefined;
}

function unifyInner(
  a: Term,
  b: Term,
  subst: Substitution,
  enableOccursCheck: boolean
): Substitution | undefined {
  if (a.kind === 'atom' && isVariableSymbol(a.symbol)) {
    return bind(a.symbol, b, subst, enableOccursCheck);
  }
  if (b.kind === 'atom' && isVariableSymbol(b.symbol)) {
    return bind(b.symbol, a, subst, enableOccursCheck);
  }
  if (a.kind === 'atom' && b.kind === 'atom') {
    return a.symbol === b.symbol ? subst : undefined;
  }
  if (
    !isCompound(a) ||
    !isCompound(b) ||
    a.kind !== b.kind ||
    (a.args?.length ?? 0) !== (b.args?.length ?? 0)
  ) {
    return undefined;
  }

  const aArgs = a.args ?? [];
  const bArgs = b.args ?? [];
  let s: Substitution | undefined = subst;
  for (let i = 0; i < aArgs.length; i++) {
    const next = aArgs[i];
    const nextB = bArgs[i];
    if (!next || !nextB) return undefined;
    s = unifyInner(next, nextB, s, enableOccursCheck);
    if (!s) return undefined;
  }
  return s;
}

const bind = (
  variable: string,
  value: Term,
  subst: Substitution,
  enableOccursCheck: boolean
): Substitution | undefined => {
  if (enableOccursCheck && occursCheck(variable, value, subst)) return undefined;
  const bound = subst[variable];
  return bound ? (termsEqual(bound, value) ? subst : undefined) : { ...subst, [variable]: value };
};
