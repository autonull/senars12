const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;
function fnv1a(data) {
    let hash = FNV_OFFSET;
    for (let i = 0; i < data.length; i++) {
        hash ^= data.charCodeAt(i);
        hash *= FNV_PRIME;
    }
    return hash >>> 0;
}
export function hashAtom(atom) {
    switch (atom.kind) {
        case 0:
            return fnv1a(`sym:${atom.value}`);
        case 1:
            return fnv1a(`var:${atom.name}`);
        case 2:
            return fnv1a(`num:${atom.value}`);
        case 3:
            return fnv1a(`str:${atom.value}`);
        case 4: {
            const expr = atom;
            let h = hashAtom(expr.operator);
            for (const arg of expr.args) {
                h = (h ^ hashAtom(arg)) * FNV_PRIME;
            }
            return h >>> 0;
        }
        case 5: {
            const grounded = atom;
            let h = fnv1a(`grounded:${grounded.op}`);
            for (const arg of grounded.args) {
                h = (h ^ hashAtom(arg)) * FNV_PRIME;
            }
            return h >>> 0;
        }
        default:
            throw new Error(`Unknown atom kind: ${atom.kind}`);
    }
}
export function equalAtoms(a, b) {
    if (a.kind !== b.kind)
        return false;
    switch (a.kind) {
        case 0:
            return a.value === b.value;
        case 1:
            return a.name === b.name;
        case 2:
            return a.value === b.value;
        case 3:
            return a.value === b.value;
        case 4: {
            const ae = a;
            const be = b;
            if (!equalAtoms(ae.operator, be.operator))
                return false;
            if (ae.args.length !== be.args.length)
                return false;
            for (let i = 0; i < ae.args.length; i++) {
                if (!equalAtoms(ae.args[i], be.args[i]))
                    return false;
            }
            return true;
        }
        case 5: {
            const ag = a;
            const bg = b;
            if (ag.op !== bg.op)
                return false;
            if (ag.args.length !== bg.args.length)
                return false;
            for (let i = 0; i < ag.args.length; i++) {
                if (!equalAtoms(ag.args[i], bg.args[i]))
                    return false;
            }
            return true;
        }
        default:
            return false;
    }
}
//# sourceMappingURL=hash.js.map