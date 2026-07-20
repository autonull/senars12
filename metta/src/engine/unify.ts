import type { ExpressionAtom, MeTTaAtom } from '../types/ast.js';
import { isVariable } from '../types/ast.js';

export type Substitution = Map<string, MeTTaAtom>;

export function unify(
  a: MeTTaAtom,
  b: MeTTaAtom,
  subst: Substitution = new Map()
): Substitution | null {
  if (isVariable(a) && subst.has(a.name)) {
    return unify(subst.get(a.name) as MeTTaAtom, b, subst);
  }
  if (isVariable(b) && subst.has(b.name)) {
    return unify(a, subst.get(b.name) as MeTTaAtom, subst);
  }

  if (isVariable(a)) {
    if (occursCheck(a.name, b, subst)) {
      return null;
    }
    subst.set(a.name, b);
    return subst;
  }

  if (isVariable(b)) {
    if (occursCheck(b.name, a, subst)) {
      return null;
    }
    subst.set(b.name, a);
    return subst;
  }

  if (a.kind !== b.kind) return null;

  switch (a.kind) {
    case 0:
      return (a as { value: string }).value === (b as { value: string }).value ? subst : null;
    case 2:
      return (a as { value: number }).value === (b as { value: number }).value ? subst : null;
    case 3:
      return (a as { value: string }).value === (b as { value: string }).value ? subst : null;
    case 4: {
      const ae = a as ExpressionAtom;
      const be = b as ExpressionAtom;

      const opSubst = unify(ae.operator, be.operator, subst);
      if (!opSubst) return null;

      let currentSubst = opSubst;
      for (let i = 0; i < ae.args.length && i < be.args.length; i++) {
        const argSubst = unify(ae.args[i] as MeTTaAtom, be.args[i] as MeTTaAtom, currentSubst);
        if (!argSubst) return null;
        currentSubst = argSubst;
      }
      if (ae.args.length !== be.args.length) return null;
      return currentSubst;
    }
    case 5: {
      const ag = a as { op: string; args: readonly MeTTaAtom[] };
      const bg = b as { op: string; args: readonly MeTTaAtom[] };
      if (ag.op !== bg.op) return null;

      let currentSubst = subst;
      for (let i = 0; i < ag.args.length && i < bg.args.length; i++) {
        const argSubst = unify(ag.args[i] as MeTTaAtom, bg.args[i] as MeTTaAtom, currentSubst);
        if (!argSubst) return null;
        currentSubst = argSubst;
      }
      if (ag.args.length !== bg.args.length) return null;
      return currentSubst;
    }
    default:
      return subst;
  }
}

function occursCheck(varName: string, atom: MeTTaAtom, subst: Substitution): boolean {
  if (isVariable(atom) && atom.name === varName) return true;
  if (atom.kind === 4) {
    const expr = atom as ExpressionAtom;
    if (occursCheck(varName, expr.operator, subst)) return true;
    for (const arg of expr.args) {
      if (occursCheck(varName, arg as MeTTaAtom, subst)) return true;
    }
  }
  if (atom.kind === 5) {
    const grounded = atom as { op: string; args: readonly MeTTaAtom[] };
    for (const arg of grounded.args) {
      if (occursCheck(varName, arg as MeTTaAtom, subst)) return true;
    }
  }
  return false;
}

export function applySubst(atom: MeTTaAtom, subst: Substitution): MeTTaAtom {
  switch (atom.kind) {
    case 0:
      return atom;
    case 1: {
      const value = subst.get(atom.name);
      if (value) return value;
      return atom;
    }
    case 2:
    case 3:
      return atom;
    case 4: {
      const expr = atom as ExpressionAtom;
      const newOp = applySubst(expr.operator, subst);
      const newArgs = expr.args.map((arg) => applySubst(arg as MeTTaAtom, subst));
      return { kind: 4, operator: newOp, args: newArgs };
    }
    case 5: {
      const grounded = atom as { op: string; args: readonly MeTTaAtom[] };
      const newArgs = grounded.args.map((arg) => applySubst(arg as MeTTaAtom, subst));
      return { kind: 5, op: grounded.op, args: newArgs };
    }
    default:
      return atom;
  }
}
