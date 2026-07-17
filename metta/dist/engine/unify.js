import { isVariable } from '../types/ast.js';
export function unify(a, b, subst = new Map()) {
    if (isVariable(a) && subst.has(a.name)) {
        return unify(subst.get(a.name), b, subst);
    }
    if (isVariable(b) && subst.has(b.name)) {
        return unify(a, subst.get(b.name), subst);
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
    if (a.kind !== b.kind)
        return null;
    switch (a.kind) {
        case 0:
            return a.value === b.value ? subst : null;
        case 2:
            return a.value === b.value ? subst : null;
        case 3:
            return a.value === b.value ? subst : null;
        case 4: {
            const ae = a;
            const be = b;
            const opSubst = unify(ae.operator, be.operator, subst);
            if (!opSubst)
                return null;
            let currentSubst = opSubst;
            for (let i = 0; i < ae.args.length && i < be.args.length; i++) {
                const argSubst = unify(ae.args[i], be.args[i], currentSubst);
                if (!argSubst)
                    return null;
                currentSubst = argSubst;
            }
            if (ae.args.length !== be.args.length)
                return null;
            return currentSubst;
        }
        case 5: {
            const ag = a;
            const bg = b;
            if (ag.op !== bg.op)
                return null;
            let currentSubst = subst;
            for (let i = 0; i < ag.args.length && i < bg.args.length; i++) {
                const argSubst = unify(ag.args[i], bg.args[i], currentSubst);
                if (!argSubst)
                    return null;
                currentSubst = argSubst;
            }
            if (ag.args.length !== bg.args.length)
                return null;
            return currentSubst;
        }
        default:
            return subst;
    }
}
function occursCheck(varName, atom, subst) {
    if (isVariable(atom) && atom.name === varName)
        return true;
    if (atom.kind === 4) {
        const expr = atom;
        if (occursCheck(varName, expr.operator, subst))
            return true;
        for (const arg of expr.args) {
            if (occursCheck(varName, arg, subst))
                return true;
        }
    }
    if (atom.kind === 5) {
        const grounded = atom;
        for (const arg of grounded.args) {
            if (occursCheck(varName, arg, subst))
                return true;
        }
    }
    return false;
}
export function applySubst(atom, subst) {
    switch (atom.kind) {
        case 0:
            return atom;
        case 1: {
            const value = subst.get(atom.name);
            if (value)
                return value;
            return atom;
        }
        case 2:
        case 3:
            return atom;
        case 4: {
            const expr = atom;
            const newOp = applySubst(expr.operator, subst);
            const newArgs = expr.args.map((arg) => applySubst(arg, subst));
            return { kind: 4, operator: newOp, args: newArgs };
        }
        case 5: {
            const grounded = atom;
            const newArgs = grounded.args.map((arg) => applySubst(arg, subst));
            return { kind: 5, op: grounded.op, args: newArgs };
        }
        default:
            return atom;
    }
}
//# sourceMappingURL=unify.js.map