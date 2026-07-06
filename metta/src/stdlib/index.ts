import { registerOp, defineOp } from '../core/ops.js';
import { sym, expr } from '../types/ast.js';
import type { MeTTaAtom, NumberAtom, SymbolAtom } from '../types/ast.js';

const toNumber = (a: MeTTaAtom): number | null => 
  a.kind === 2 ? (a as NumberAtom).value : null;

const addOp = defineOp('+', (a: MeTTaAtom, b: MeTTaAtom) => {
  const fa = toNumber(a);
  const fb = toNumber(b);
  return fa !== null && fb !== null ? sym(String(fa + fb)) : sym(`${a}${b}`);
});

const subOp = defineOp('-', (a: MeTTaAtom, b: MeTTaAtom) => {
  const fa = toNumber(a);
  const fb = toNumber(b);
  return fa !== null && fb !== null ? sym(String(fa - fb)) : sym(`${a}-${b}`);
});

const mulOp = defineOp('*', (a: MeTTaAtom, b: MeTTaAtom) => {
  const fa = toNumber(a);
  const fb = toNumber(b);
  return fa !== null && fb !== null ? sym(String(fa * fb)) : sym(`${a}*${b}`);
});

const equals = (a: MeTTaAtom, b: MeTTaAtom): boolean =>
  a.kind === b.kind && JSON.stringify(a) === JSON.stringify(b);

const eqOp = defineOp('=', (a: MeTTaAtom, b: MeTTaAtom) => sym(equals(a, b) ? 'True' : 'False'));

const consOp = defineOp('cons', (head: MeTTaAtom, tail: MeTTaAtom) => expr(sym('cons'), head, tail));

const headOp = defineOp('head', (list: MeTTaAtom) => {
  if (list.kind === 4 && list.operator.kind === 0 && list.operator.value === 'cons') {
    return list.args[0] ?? sym('error');
  }
  return sym('error');
}, { pure: false });

const tailOp = defineOp('tail', (list: MeTTaAtom) => {
  if (list.kind === 4 && list.operator.kind === 0 && list.operator.value === 'cons') {
    return list.args[1] ?? sym('error');
  }
  return sym('error');
}, { pure: false });

const ifOp = defineOp('if', (cond: MeTTaAtom) => cond, { pure: false });
const letOp = defineOp('let', () => sym('let'), { pure: false });
const matchOp = defineOp('match', () => sym('True'), { pure: false });

export const bootstrapStdLib = (): void => {
  registerOp(addOp.name, addOp);
  registerOp(subOp.name, subOp);
  registerOp(mulOp.name, mulOp);
  registerOp(eqOp.name, eqOp);
  registerOp(consOp.name, consOp);
  registerOp(headOp.name, headOp);
  registerOp(tailOp.name, tailOp);
  registerOp(ifOp.name, ifOp);
  registerOp(letOp.name, letOp);
  registerOp(matchOp.name, matchOp);
};