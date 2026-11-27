import { equalAtoms } from '../core/hash';
import { defineOp, registerOp } from '../core/ops';
import { expr, num, str, sym } from '../types/ast';
import { SenarsError } from '../../errors/senars-error';
const toNumber = (a) => (a.kind === 2 ? a.value : null);
const atomToString = (a) => a.kind === 3 ? a.value : null;
const isConsAtom = (a) => a.kind === 4 && a.operator.kind === 0 && a.operator.value === 'cons';
const arithOp = (name, fn) => defineOp(name, (a, b) => {
    const fa = toNumber(a);
    const fb = toNumber(b);
    return fa !== null && fb !== null ? sym(String(fn(fa, fb))) : sym(`${a}${name}${b}`);
});
const cmpOp = (name, fn) => defineOp(name, (a, b) => {
    const fa = toNumber(a);
    const fb = toNumber(b);
    return fa !== null && fb !== null ? sym(fn(fa, fb) ? 'True' : 'False') : sym('False');
});
const addOp = arithOp('+', (a, b) => a + b);
const subOp = arithOp('-', (a, b) => a - b);
const mulOp = arithOp('*', (a, b) => a * b);
const divOp = arithOp('/', (a, b) => (b !== 0 ? a / b : Number.NaN));
const modOp = arithOp('%', (a, b) => a % b);
const powOp = arithOp('^', (a, b) => a ** b);
/**
 * Phase C (REFACTOR.todo3): pre-reduce arithmetic/logic subterms before the
 * structural compare, so `(= (+ 2 2) 4)` reduces to True (REFACTOR.todo2 §10.8).
 */
const ARITH = {
    '+': (a, b) => a + b,
    '-': (a, b) => a - b,
    '*': (a, b) => a * b,
    '/': (a, b) => (b !== 0 ? a / b : Number.NaN),
    '%': (a, b) => a % b,
    '^': (a, b) => a ** b,
};
const CMP = {
    '!=': (a, b) => a !== b,
    '<': (a, b) => a < b,
    '>': (a, b) => a > b,
    '<=': (a, b) => a <= b,
    '>=': (a, b) => a >= b,
};
const MATH1 = {
    sin: Math.sin,
    cos: Math.cos,
    sqrt: Math.sqrt,
    abs: Math.abs,
    floor: Math.floor,
    ceil: Math.ceil,
};
const normalize = (a) => {
    if (a.kind !== 4)
        return a;
    const e = a;
    if (e.operator.kind !== 0)
        return a;
    const name = e.operator.value;
    const args = e.args.map(normalize);
    if (name in ARITH || name in CMP) {
        const x = toNumber(args[0] ?? sym('undefined'));
        const y = toNumber(args[1] ?? sym('undefined'));
        if (x !== null && y !== null)
            return name in ARITH ? num(ARITH[name](x, y)) : sym(CMP[name](x, y) ? 'True' : 'False');
    }
    if (name in MATH1) {
        const x = toNumber(args[0] ?? sym('undefined'));
        if (x !== null)
            return num(MATH1[name](x));
    }
    return expr(e.operator, ...args);
};
const eqOp = defineOp('=', (a, b) => sym(equalAtoms(normalize(a), normalize(b)) ? 'True' : 'False'));
const neOp = cmpOp('!=', (a, b) => a !== b);
const ltOp = cmpOp('<', (a, b) => a < b);
const gtOp = cmpOp('>', (a, b) => a > b);
const leOp = cmpOp('<=', (a, b) => a <= b);
const geOp = cmpOp('>=', (a, b) => a >= b);
const consOp = defineOp('cons', (head, tail) => expr(sym('cons'), head, tail));
const headOp = defineOp('head', (list) => {
    if (isConsAtom(list))
        return list.args[0] ?? sym('error');
    return sym('error');
}, { pure: false });
const tailOp = defineOp('tail', (list) => {
    if (isConsAtom(list))
        return list.args[1] ?? sym('error');
    return sym('error');
}, { pure: false });
const lengthOp = defineOp('length', (list) => {
    let len = 0;
    let current = list;
    while (isConsAtom(current)) {
        len++;
        current = current.args[1] ?? sym('error');
    }
    return num(len);
});
const appendOp = defineOp('append', (a, b) => {
    if (!isConsAtom(a))
        return b;
    let result = a;
    while (isConsAtom(result) && isConsAtom(result.args[1] ?? sym('error'))) {
        result = result.args[1] ?? sym('error');
    }
    if (isConsAtom(result)) {
        return expr(sym('cons'), result.args[0] ?? sym('error'), expr(sym('cons'), result.args[1] ?? sym('error'), b));
    }
    return expr(sym('cons'), a, b);
});
const mapOp = defineOp('map', (fn, list) => {
    if (!isConsAtom(list))
        return list;
    return expr(sym('cons'), fn, expr(sym('cons'), list.args[0] ?? sym('error'), expr(sym('map'), fn, list.args[1] ?? sym('error'))));
}, { pure: false });
const filterOp = defineOp('filter', (pred, list) => {
    if (!isConsAtom(list))
        return list;
    return expr(sym('filter'), pred, list.args[1] ?? sym('error'));
}, { pure: false });
const stringConcatOp = defineOp('concat', (a, b) => {
    const sa = atomToString(a);
    const sb = atomToString(b);
    return sa !== null && sb !== null ? str(sa + sb) : sym(`${a}${b}`);
});
const stringLengthOp = defineOp('length', (s) => {
    const ss = atomToString(s);
    return ss !== null ? num(ss.length) : num(0);
});
const mathOp = (name, fn) => defineOp(name, (a) => {
    const fa = toNumber(a);
    return fa !== null ? sym(String(fn(fa))) : sym(`${name}(${a})`);
});
const sinOp = mathOp('sin', Math.sin);
const cosOp = mathOp('cos', Math.cos);
const sqrtOp = mathOp('sqrt', Math.sqrt);
const absOp = mathOp('abs', Math.abs);
const floorOp = mathOp('floor', Math.floor);
const ceilOp = mathOp('ceil', Math.ceil);
const ifOp = defineOp('if', (cond, thenBranch, elseBranch) => cond.kind === 0 && cond.value === 'True' ? thenBranch : elseBranch, { pure: false });
const letOp = defineOp('let', (_name, _value, body) => body, {
    pure: false,
});
const matchOp = defineOp('match', (_pattern, _target) => sym('True'), {
    pure: false,
});
const printOp = defineOp('print', (msg) => {
    console.log(msg);
    return sym('True');
}, { pure: false });
const errorOp = defineOp('error', (msg) => {
    throw new SenarsError(`MeTTa error: ${msg}`, 'OPERATION_ERROR');
}, { pure: false });
export const bootstrapStdLib = () => {
    registerOp(addOp.name, addOp);
    registerOp(subOp.name, subOp);
    registerOp(mulOp.name, mulOp);
    registerOp(divOp.name, divOp);
    registerOp(modOp.name, modOp);
    registerOp(powOp.name, powOp);
    registerOp(eqOp.name, eqOp);
    registerOp(neOp.name, neOp);
    registerOp(ltOp.name, ltOp);
    registerOp(gtOp.name, gtOp);
    registerOp(leOp.name, leOp);
    registerOp(geOp.name, geOp);
    registerOp(consOp.name, consOp);
    registerOp(headOp.name, headOp);
    registerOp(tailOp.name, tailOp);
    registerOp(lengthOp.name, lengthOp);
    registerOp(appendOp.name, appendOp);
    registerOp(mapOp.name, mapOp);
    registerOp(filterOp.name, filterOp);
    registerOp(stringConcatOp.name, stringConcatOp);
    registerOp(stringLengthOp.name, stringLengthOp);
    registerOp(sinOp.name, sinOp);
    registerOp(cosOp.name, cosOp);
    registerOp(sqrtOp.name, sqrtOp);
    registerOp(absOp.name, absOp);
    registerOp(floorOp.name, floorOp);
    registerOp(ceilOp.name, ceilOp);
    registerOp(ifOp.name, ifOp);
    registerOp(letOp.name, letOp);
    registerOp(matchOp.name, matchOp);
    registerOp(printOp.name, printOp);
    registerOp(errorOp.name, errorOp);
};
