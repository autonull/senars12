import { Unifier, type UnifierDialect } from '@senars/util';
import type { ExpressionAtom, GroundedAtom, MeTTaAtom } from '../types/ast.js';
import { AtomKind, isVariable } from '../types/ast.js';
import { equalAtoms, hashAtom } from '../core/hash.js';

export type Substitution = Map<string, MeTTaAtom>;

/**
 * How the generic unifier reads a MeTTa atom. `Expression` exposes its
 * operator as the first child so operator and argument unification share one
 * descent; `Grounded` keeps its string op in `rebuild` and exposes args only.
 */
const DIALECT: UnifierDialect<MeTTaAtom> = {
  variableName: (a) => (isVariable(a) ? a.name : null),
  key: (a) => `${a.kind}#${hashAtom(a)}`,
  equal: equalAtoms,
  sameHead: (a, b) => a.kind === b.kind,
  children: (a) =>
    a.kind === AtomKind.Expression
      ? [(a as ExpressionAtom).operator, ...(a as ExpressionAtom).args]
      : a.kind === AtomKind.Grounded
        ? (a as GroundedAtom).args
        : [],
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
