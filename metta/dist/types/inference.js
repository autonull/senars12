import { AtomKind } from '../types/ast.js';
import { TypeKind, isTypeVar, typecon, typefun, typevar, } from './type.js';
let nextTypeId = 0;
export const freshType = () => typevar(nextTypeId++);
export const resetTypeIds = () => {
    nextTypeId = 0;
};
export const applyTypeSubst = (t, s) => {
    if (isTypeVar(t)) {
        const subst = s.get(t.id);
        return subst ? applyTypeSubst(subst, s) : t;
    }
    if (t.kind === TypeKind.Con)
        return t;
    return typefun(applyTypeSubst(t.from, s), applyTypeSubst(t.to, s));
};
export const composeSubst = (s1, s2) => {
    const result = new Map(s2);
    for (const [k, v] of s1) {
        result.set(k, applyTypeSubst(v, s2));
    }
    return result;
};
export const occursCheck = (id, t, s) => {
    const expanded = applyTypeSubst(t, s);
    if (isTypeVar(expanded))
        return expanded.id === id;
    if (expanded.kind === TypeKind.Con)
        return false;
    return occursCheck(id, expanded.from, s) || occursCheck(id, expanded.to, s);
};
export const unifyTypes = (t1, t2, s) => {
    const u1 = applyTypeSubst(t1, s);
    const u2 = applyTypeSubst(t2, s);
    if (isTypeVar(u1) && isTypeVar(u2) && u1.id === u2.id)
        return s;
    if (isTypeVar(u1)) {
        if (occursCheck(u1.id, u2, s))
            return null;
        return new Map(s).set(u1.id, u2);
    }
    if (isTypeVar(u2)) {
        if (occursCheck(u2.id, u1, s))
            return null;
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
export class TypeChecker {
    env = new Map();
    constructor(initialEnv) {
        if (initialEnv)
            this.env = new Map(initialEnv);
    }
    addBinding(name, scheme) {
        this.env.set(name, scheme);
    }
    infer(atom) {
        const result = this.inferType(atom, new Map());
        return result ? { type: applyTypeSubst(result.type, result.subst), subst: result.subst } : null;
    }
    inferType(atom, subst) {
        if (atom.kind === AtomKind.Variable) {
            const scheme = this.env.get(atom.name);
            if (!scheme)
                return null;
            const { type, subst: instSubst } = this.instantiate(scheme);
            return { type, subst: composeSubst(instSubst, subst) };
        }
        if (atom.kind === AtomKind.Symbol) {
            const scheme = this.env.get(atom.value);
            if (!scheme)
                return null;
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
    instantiate(scheme) {
        const subst = new Map();
        const freshVars = scheme.vars.map(() => freshType());
        const varSubst = new Map();
        scheme.vars.forEach((v, i) => {
            const fv = freshVars[i];
            if (fv)
                varSubst.set(v, fv);
        });
        return { type: applyTypeSubst(scheme.type, varSubst), subst };
    }
    inferExpr(expr, subst) {
        const opResult = this.inferType(expr.operator, subst);
        if (!opResult)
            return null;
        const argResults = [];
        for (const arg of expr.args) {
            const argResult = this.inferType(arg, opResult.subst);
            if (!argResult)
                return null;
            argResults.push(argResult);
        }
        const opType = applyTypeSubst(opResult.type, opResult.subst);
        if (opType.kind !== TypeKind.Fun)
            return null;
        const argType = argResults[0]?.type;
        if (!argType)
            return null;
        const argSubst = unifyTypes(opType.from, argType, opResult.subst);
        if (!argSubst)
            return null;
        return { type: opType.to, subst: argSubst };
    }
}
//# sourceMappingURL=inference.js.map