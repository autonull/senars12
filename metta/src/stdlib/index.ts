import { defineOp, registerOp } from '../core/ops.js';
import { expr, num, str, sym } from '../types/ast.js';
import type { ExpressionAtom, MeTTaAtom, NumberAtom } from '../types/ast.js';

const toNumber = (a: MeTTaAtom): number | null => (a.kind === 2 ? (a as NumberAtom).value : null);

const atomToString = (a: MeTTaAtom): string | null =>
  a.kind === 3 ? (a as { readonly value: string }).value : null;

const equals = (a: MeTTaAtom, b: MeTTaAtom): boolean =>
  a.kind === b.kind && JSON.stringify(a) === JSON.stringify(b);

const isConsAtom = (a: MeTTaAtom): a is ExpressionAtom =>
  a.kind === 4 && a.operator.kind === 0 && a.operator.value === 'cons';

const arithOp = (name: string, fn: (a: number, b: number) => number) =>
  defineOp(name, (a: MeTTaAtom, b: MeTTaAtom) => {
    const fa = toNumber(a);
    const fb = toNumber(b);
    return fa !== null && fb !== null ? sym(String(fn(fa, fb))) : sym(`${a}${name}${b}`);
  });

const cmpOp = (name: string, fn: (a: number, b: number) => boolean) =>
  defineOp(name, (a: MeTTaAtom, b: MeTTaAtom) => {
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

const eqOp = defineOp('=', (a: MeTTaAtom, b: MeTTaAtom) => sym(equals(a, b) ? 'True' : 'False'));
const neOp = cmpOp('!=', (a, b) => a !== b);
const ltOp = cmpOp('<', (a, b) => a < b);
const gtOp = cmpOp('>', (a, b) => a > b);
const leOp = cmpOp('<=', (a, b) => a <= b);
const geOp = cmpOp('>=', (a, b) => a >= b);

const consOp = defineOp('cons', (head: MeTTaAtom, tail: MeTTaAtom) =>
  expr(sym('cons'), head, tail)
);

const headOp = defineOp(
  'head',
  (list: MeTTaAtom) => {
    if (isConsAtom(list)) return list.args[0] ?? sym('error');
    return sym('error');
  },
  { pure: false }
);

const tailOp = defineOp(
  'tail',
  (list: MeTTaAtom) => {
    if (isConsAtom(list)) return list.args[1] ?? sym('error');
    return sym('error');
  },
  { pure: false }
);

const lengthOp = defineOp('length', (list: MeTTaAtom) => {
  let len = 0;
  let current = list;
  while (isConsAtom(current)) {
    len++;
    current = current.args[1] ?? sym('error');
  }
  return num(len);
});

const appendOp = defineOp('append', (a: MeTTaAtom, b: MeTTaAtom) => {
  if (!isConsAtom(a)) return b;
  let result = a as ExpressionAtom;
  while (isConsAtom(result) && isConsAtom((result.args[1] as ExpressionAtom) ?? sym('error'))) {
    result = (result.args[1] as ExpressionAtom) ?? sym('error');
  }
  if (isConsAtom(result)) {
    return expr(
      sym('cons'),
      result.args[0] ?? sym('error'),
      expr(sym('cons'), result.args[1] ?? sym('error'), b)
    );
  }
  return expr(sym('cons'), a, b);
});

const mapOp = defineOp(
  'map',
  (fn: MeTTaAtom, list: MeTTaAtom) => {
    if (!isConsAtom(list)) return list;
    return expr(
      sym('cons'),
      fn,
      expr(
        sym('cons'),
        list.args[0] ?? sym('error'),
        expr(sym('map'), fn, list.args[1] ?? sym('error'))
      )
    );
  },
  { pure: false }
);

const filterOp = defineOp(
  'filter',
  (pred: MeTTaAtom, list: MeTTaAtom) => {
    if (!isConsAtom(list)) return list;
    return expr(sym('filter'), pred, list.args[1] ?? sym('error'));
  },
  { pure: false }
);

const stringConcatOp = defineOp('concat', (a: MeTTaAtom, b: MeTTaAtom) => {
  const sa = atomToString(a);
  const sb = atomToString(b);
  return sa !== null && sb !== null ? str(sa + sb) : sym(`${a}${b}`);
});

const stringLengthOp = defineOp('length', (s: MeTTaAtom) => {
  const ss = atomToString(s);
  return ss !== null ? num(ss.length) : num(0);
});

const mathOp = (name: string, fn: (x: number) => number) =>
  defineOp(name, (a: MeTTaAtom) => {
    const fa = toNumber(a);
    return fa !== null ? sym(String(fn(fa))) : sym(`${name}(${a})`);
  });

const sinOp = mathOp('sin', Math.sin);
const cosOp = mathOp('cos', Math.cos);
const sqrtOp = mathOp('sqrt', Math.sqrt);
const absOp = mathOp('abs', Math.abs);
const floorOp = mathOp('floor', Math.floor);
const ceilOp = mathOp('ceil', Math.ceil);

const ifOp = defineOp(
  'if',
  (cond: MeTTaAtom, thenBranch: MeTTaAtom, elseBranch: MeTTaAtom) =>
    cond.kind === 0 && cond.value === 'True' ? thenBranch : elseBranch,
  { pure: false }
);

const letOp = defineOp('let', (name: MeTTaAtom, value: MeTTaAtom, body: MeTTaAtom) => body, {
  pure: false,
});
const matchOp = defineOp('match', (pattern: MeTTaAtom, target: MeTTaAtom) => sym('True'), {
  pure: false,
});

const printOp = defineOp(
  'print',
  (msg: MeTTaAtom) => {
    console.log(msg);
    return sym('True');
  },
  { pure: false }
);

const errorOp = defineOp(
  'error',
  (msg: MeTTaAtom) => {
    throw new Error(`MeTTa error: ${msg}`);
  },
  { pure: false }
);

export const bootstrapStdLib = (): void => {
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
