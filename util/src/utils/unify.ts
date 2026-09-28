/**
 * Structural unification over an arbitrary term AST — the single Robinson
 * unifier behind the Narsese unifier and the MeTTa pattern unifier.
 *
 * Both dialects are the same algorithm over a different node type: bind
 * variables, recurse through children, fail on a structural mismatch. The
 * differences are entirely in *how a node is inspected*, so that is all this
 * module parameterizes. What callers get that neither had:
 *
 * - **A length check before descent**, so a failed unification cannot leave
 *   the caller's bindings half-written.
 * - **A default-on occurs check** that chases existing bindings, so `?x = (?x
 *   --> a)` is rejected rather than building a cyclic term.
 * - **Memoization** (toggleable) keyed on the *bound values*, not just the
 *   bound variable names — the only key that is actually correct.
 * - **Full substitution application**, replacing three hand-rolled recursions.
 *
 * Substitutions are plain `Map`s and are treated as immutable: the caller's
 * map is never written to, and a failed unification returns `null` having
 * changed nothing.
 */

import { LruCache } from './lru-cache.js';

/**
 * How to read one term dialect. Implementations are pure and must be cheap —
 * every node visit calls all five.
 */
export interface UnifierDialect<T> {
  /** The variable's name when `node` is a variable, else `null`. */
  variableName: (node: T) => string | null;
  /** Canonical structural key — the single identity for memoization. */
  key: (node: T) => string;
  /** Structural equality of two non-variable nodes. */
  equal: (a: T, b: T) => boolean;
  /** True when both nodes share a head, so their children can be paired. */
  sameHead: (a: T, b: T) => boolean;
  /** Immediate sub-nodes, in binding order. */
  children: (node: T) => readonly T[];
  /** Copy of `node` with `kids` as its children. */
  rebuild: (node: T, kids: readonly T[]) => T;
}

export interface UnifyOptions {
  /** Reject bindings that would make a term cyclic. Default true. */
  occursCheck?: boolean;
  /** Reuse sub-unification results across calls. Default true. */
  memoize?: boolean;
  /** Memo capacity when `memoize` is on. Default 1000. */
  memoCapacity?: number;
}

export type Substitution<T> = ReadonlyMap<string, T>;

/** Depth cap for the occurs check and variable dereferencing. */
const MAX_DEPTH = 64;

const DEFAULTS = { occursCheck: true, memoize: true, memoCapacity: 1000 } as const;

/** A memo entry is the bindings this call *added*, or `null` for failure. */
type Delta<T> = readonly (readonly [string, T])[] | null;

/** Rebuild a memoized result by replaying its delta onto the caller's map. */
const replay = <T>(subst: Substitution<T>, delta: Delta<T>): Map<string, T> => {
  const out = new Map(subst);
  if (delta) for (const [name, value] of delta) out.set(name, value);
  return out;
};

export class Unifier<T> {
  readonly #ast: UnifierDialect<T>;
  readonly #memoize: boolean;
  /** Allocated only when memoization is on — a disabled unifier stays allocation-free. */
  readonly #memo: LruCache<string, Delta<T>> | null;

  constructor(ast: UnifierDialect<T>, options: UnifyOptions = {}) {
    this.#ast = ast;
    this.#memoize = options.memoize ?? DEFAULTS.memoize;
    this.#memo = this.#memoize
      ? new LruCache(options.memoCapacity ?? DEFAULTS.memoCapacity)
      : null;
  }

  /**
   * Unify `a` and `b`, extending `subst`. Returns the extended substitution, or
   * `null` when they do not unify — in which case `subst` is untouched.
   */
  unify(
    a: T,
    b: T,
    subst: Substitution<T> = new Map(),
    options: UnifyOptions = {}
  ): Map<string, T> | null {
    const occurs = options.occursCheck ?? DEFAULTS.occursCheck;
    const memo = (options.memoize ?? this.#memoize) ? this.#memo : null;
    const key = memo ? this.#key(a, b, subst, occurs) : undefined;

    if (memo && key !== undefined) {
      const hit = memo.get(key);
      if (hit !== undefined) return hit === null ? null : replay(subst, hit);
    }

    const work = new Map(subst);
    const added: [string, T][] = [];
    const result = this.#descend(a, b, work, added, occurs, 0) ? work : null;
    // Cache the *delta* rather than the result map: a replay is rebuilt onto
    // the caller's own map, so no cached entry is ever aliased to a caller.
    if (memo && key !== undefined) memo.set(key, result === null ? null : added);
    return result;
  }

  /** Substitute through `term` until no bound variable remains. Idempotent. */
  apply(term: T, subst: Substitution<T>): T {
    const name = this.#ast.variableName(term);
    if (name !== null) {
      const bound = subst.get(name);
      if (bound === undefined) return term;
      const next = this.apply(bound, subst);
      return this.#ast.equal(next, term) ? term : next;
    }
    const kids = this.#ast.children(term);
    if (kids.length === 0) return term;
    let changed = false;
    const applied = kids.map((kid) => {
      const next = this.apply(kid, subst);
      if (next !== kid) changed = true;
      return next;
    });
    return changed ? this.#ast.rebuild(term, applied) : term;
  }

  /** Variables appearing anywhere in `term`, in first-occurrence order. */
  variables(term: T): string[] {
    const found: string[] = [];
    const seen = new Set<string>();
    const walk = (node: T): void => {
      const name = this.#ast.variableName(node);
      if (name !== null) {
        if (!seen.has(name)) {
          seen.add(name);
          found.push(name);
        }
        return;
      }
      for (const kid of this.#ast.children(node)) walk(kid);
    };
    walk(term);
    return found;
  }

  clearCache(): void {
    this.#memo?.clear();
  }

  /** Memo key: both terms plus every *bound value*, never just the names. */
  #key(a: T, b: T, subst: Substitution<T>, occurs: boolean): string {
    const { key } = this.#ast;
    if (subst.size === 0) return `${occurs ? 1 : 0}|${key(a)}|${key(b)}`;
    const bindings: string[] = [];
    for (const [name, value] of subst) bindings.push(`${name}=${key(value)}`);
    bindings.sort();
    return `${occurs ? 1 : 0}|${key(a)}|${key(b)}|${bindings.join(';')}`;
  }

  /** Follow a variable's bindings to the term they resolve to. */
  #deref(node: T, work: ReadonlyMap<string, T>, depth: number): T {
    const name = this.#ast.variableName(node);
    if (name === null || depth >= MAX_DEPTH) return node;
    const bound = work.get(name);
    return bound === undefined ? node : this.#deref(bound, work, depth + 1);
  }

  /** True when `variable` occurs in `node`, following existing bindings. */
  #occurs(variable: string, node: T, work: ReadonlyMap<string, T>, depth: number): boolean {
    if (depth >= MAX_DEPTH) return false;
    const name = this.#ast.variableName(node);
    if (name === variable) return true;
    if (name !== null) {
      const bound = work.get(name);
      return bound === undefined ? false : this.#occurs(variable, bound, work, depth + 1);
    }
    for (const kid of this.#ast.children(node)) {
      if (this.#occurs(variable, kid, work, depth + 1)) return true;
    }
    return false;
  }

  #bind(
    variable: string,
    value: T,
    work: Map<string, T>,
    added: [string, T][],
    occurs: boolean
  ): boolean {
    if (occurs && this.#occurs(variable, value, work, 0)) return false;
    work.set(variable, value);
    added.push([variable, value]);
    return true;
  }

  #descend(
    a: T,
    b: T,
    work: Map<string, T>,
    added: [string, T][],
    occurs: boolean,
    depth: number
  ): boolean {
    if (depth >= MAX_DEPTH) return false;
    const ast = this.#ast;
    const left = this.#deref(a, work, 0);
    const right = this.#deref(b, work, 0);
    if (left === right) return true;

    const name = ast.variableName(left);
    const other = ast.variableName(right);
    // The same variable on both sides is already unified — binding it would
    // self-occur and fail the occurs check.
    if (name !== null && name === other) return true;
    if (name !== null) return this.#bind(name, right, work, added, occurs);
    if (other !== null) return this.#bind(other, left, work, added, occurs);
    if (!ast.sameHead(left, right)) return false;
    if (ast.equal(left, right)) return true;

    const leftKids = ast.children(left);
    const rightKids = ast.children(right);
    // Check arity *before* descending, so a mismatch never half-writes `work`.
    if (leftKids.length !== rightKids.length) return false;
    // Childless nodes are decided by `equal` alone; the loop cannot reject them.
    if (leftKids.length === 0) return false;
    for (let i = 0; i < leftKids.length; i++) {
      if (!this.#descend(leftKids[i]!, rightKids[i]!, work, added, occurs, depth + 1)) return false;
    }
    return true;
  }
}
