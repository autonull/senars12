import { Unifier, type UnifierDialect } from '@senars/util';
import { ATOM_EQUALITY, atomKey } from '../core/hash.js';
import type { GroundedAtom, MeTTaAtom } from '../types/ast.js';
import { AtomKind } from '../types/ast.js';

export type Substitution = Map<string, MeTTaAtom>;

/**
 * The reading half of a MeTTa atom is `ATOM_EQUALITY`'s, so the only thing added
 * here is the two operations a comparison never performs: hashing it, and
 * rebuilding it. `Expression` exposes its operator as the first child so operator
 * and argument unification share one descent; `Grounded` keeps its string op in
 * `rebuild` and exposes args only.
 */
const DIALECT: UnifierDialect<MeTTaAtom> = {
  ...ATOM_EQUALITY,
  key: atomKey,
  rebuild: (a, kids) =>
    a.kind === AtomKind.Expression
      ? { kind: AtomKind.Expression, operator: kids[0] as MeTTaAtom, args: kids.slice(1) }
      : { kind: AtomKind.Grounded, op: (a as GroundedAtom).op, args: kids },
};

const unifier = new Unifier(DIALECT);

/**
 * Unify `a` and `b`, extending `subst`. Returns `null` when they do not
 * unify. On success the bindings are written back into `subst` and `subst`
 * itself is returned, so callers that keep a reference to the map they passed
 * in see the result — the historical contract of this function.
 */
export function unify(
  a: MeTTaAtom,
  b: MeTTaAtom,
  subst: Substitution = new Map()
): Substitution | null {
  const result = unifier.unify(a, b, subst);
  if (result === null) return null;
  subst.clear();
  for (const [name, value] of result) subst.set(name, value);
  return subst;
}

export function applySubst(atom: MeTTaAtom, subst: ReadonlyMap<string, MeTTaAtom>): MeTTaAtom {
  return unifier.apply(atom, subst);
}
