import type { MeTTaAtom, ExpressionAtom } from '../types/ast.js';
import { AtomKind } from '../types/ast.js';
import { type Type, type TypeEnv, type Subst, type TypeScheme, TypeKind, typevar, typecon, typefun, isTypeVar, type TypeVar, type TypeFun } from './type.js';

let nextTypeId = 0;
export const freshType = (): TypeVar => typevar(nextTypeId++);
export const resetTypeIds = () => { nextTypeId = 0; };

export const applyTypeSubst = (t: Type, s: Subst): Type => {
  if (isTypeVar(t)) {
    const subst = s.get(t.id);
    return subst ? applyTypeSubst(subst, s) : t;
  }
  if (t.kind === TypeKind.Con) return t;
  return typefun(applyTypeSubst(t.from, s), applyTypeSubst(t.to, s));
};

export const composeSubst = (s1: Subst, s2: Subst): Subst => {
  const result = new Map(s2);
  for (const [k, v] of s1) {
    result.set(k, applyTypeSubst(v, s2));
  }
  return result;
};

export const occursCheck = (id: number, t: Type, s: Subst): boolean => {
  const expanded = applyTypeSubst(t, s);
  if (isTypeVar(expanded)) return expanded.id === id;
  if (expanded.kind === TypeKind.Con) return false;
  return occursCheck(id, expanded.from, s) || occursCheck(id, expanded.to, s);
};

export const unifyTypes = (t1: Type, t2: Type, s: Subst): Subst | null => {
  const u1 = applyTypeSubst(t1, s);
  const u2 = applyTypeSubst(t2, s);
  if (isTypeVar(u1) && isTypeVar(u2) && u1.id === u2.id) return s;
  if (isTypeVar(u1)) {
    if (occursCheck(u1.id, u2, s)) return null;
    return new Map(s).set(u1.id, u2);
  }
  if (isTypeVar(u2)) {
    if (occursCheck(u2.id, u1, s)) return null;
    return new Map(s).set(u2.id, u1);
  }
  if (u1.kind === TypeKind.Con && u2.kind === TypeKind.Con) {
    return u1.name === u2.name ? s : null;
  }
  if (u1.kind === TypeKind.Fun && u2.kind === TypeKind.Fun) {
    const s2 = unifyTypes(u1.from, u2.from, s);
    return s2 ? unifyTypes(u1.to, u2.to, s2) : null;
  }
  return null;
};

export type TypedExpr = { atom: MeTTaAtom; type: Type };

export class TypeChecker {
  private env: TypeEnv = new Map();
  
  constructor(initialEnv?: TypeEnv) {
    if (initialEnv) this.env = new Map(initialEnv);
  }
  
  addBinding(name: string, scheme: TypeScheme): void {
    this.env.set(name, scheme);
  }
  
  infer(atom: MeTTaAtom): { type: Type; subst: Subst } | null {
    const result = this.inferType(atom, new Map());
    return result ? { type: applyTypeSubst(result.type, result.subst), subst: result.subst } : null;
  }
  
  private inferType(atom: MeTTaAtom, subst: Subst): { type: Type; subst: Subst } | null {
    if (atom.kind === AtomKind.Variable) {
      const scheme = this.env.get(atom.name);
      if (!scheme) return null;
      const { type, subst: instSubst } = this.instantiate(scheme);
      return { type, subst: composeSubst(instSubst, subst) };
    }
    if (atom.kind === AtomKind.Symbol) {
      const scheme = this.env.get(atom.value);
      if (!scheme) return null;
      const { type, subst: instSubst } = this.instantiate(scheme);
      return { type, subst: composeSubst(instSubst, subst) };
    }
    if (atom.kind === AtomKind.Number) {
      return { type: typecon('Number'), subst };
    }
    if (atom.kind === AtomKind.String) {
      return { type: typecon('String'), subst };
    }
    if (atom.kind === AtomKind.Expression) {
      return this.inferExpr(atom, subst);
    }
    return null;
  }
  
  private instantiate(scheme: TypeScheme): { type: Type; subst: Subst } {
    const subst: Subst = new Map();
    const freshVars = scheme.vars.map(() => freshType());
    const varSubst = new Map<number, Type>();
    scheme.vars.forEach((v, i) => {
      const fv = freshVars[i];
      if (fv) varSubst.set(v, fv);
    });
    return { type: applyTypeSubst(scheme.type, varSubst), subst };
  }
  
  private inferExpr(expr: ExpressionAtom, subst: Subst): { type: Type; subst: Subst } | null {
    const opResult = this.inferType(expr.operator, subst);
    if (!opResult) return null;
    
    const argResults: { type: Type; subst: Subst }[] = [];
    for (const arg of expr.args) {
      const argResult = this.inferType(arg, opResult.subst);
      if (!argResult) return null;
      argResults.push(argResult);
    }
    
    const opType = applyTypeSubst(opResult.type, opResult.subst);
    if (opType.kind !== TypeKind.Fun) return null;
    
    const argType = argResults[0]?.type;
    if (!argType) return null;
    
    const argSubst = unifyTypes(opType.from, argType, opResult.subst);
    if (!argSubst) return null;
    return { type: opType.to, subst: argSubst };
  }
}