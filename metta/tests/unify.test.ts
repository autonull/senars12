import { describe, it, expect } from 'vitest';
import { unify, applySubst } from '../src/engine/unify.js';
import { sym, varr, num, expr } from '../src/types/ast.js';

describe('Unification', () => {
  it('unifies identical symbols', () => {
    const result = unify(sym('a'), sym('a'), new Map());
    expect(result).not.toBeNull();
  });

  it('fails to unify different symbols', () => {
    const result = unify(sym('a'), sym('b'), new Map());
    expect(result).toBeNull();
  });

  it('unifies variable with symbol', () => {
    const result = unify(varr('$x'), sym('a'), new Map());
    expect(result).not.toBeNull();
    expect(result?.get('$x')).toEqual(sym('a'));
  });

  it('unifies symbol with variable', () => {
    const result = unify(sym('a'), varr('$x'), new Map());
    expect(result).not.toBeNull();
    expect(result?.get('$x')).toEqual(sym('a'));
  });

  it('unifies variables in expressions', () => {
    const result = unify(
      expr(sym('+'), varr('$x'), num(2)),
      expr(sym('+'), num(1), varr('$y'))
    );
    expect(result).not.toBeNull();
    expect(result?.get('$x')).toEqual(num(1));
    expect(result?.get('$y')).toEqual(num(2));
  });

  it('applies substitution', () => {
    const subst = new Map([['$x', sym('a')]]);
    const result = applySubst(varr('$x'), subst);
    expect(result).toEqual(sym('a'));
  });

  it('applies substitution in expressions', () => {
    const subst = new Map([['$x', sym('a')]]);
    const result = applySubst(expr(sym('+'), varr('$x'), num(1)), subst);
    expect((result as { args: { value: string }[] }).args[0]?.value).toBe('a');
  });
});