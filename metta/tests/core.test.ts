import { SenarsError } from '@senars/util/errors';
import { describe, expect, it } from 'vitest';
import { MeTTaError, MeTTaReason } from '../src/core/errors.js';
import { equalAtoms, hashAtom, matchesAtom } from '../src/core/hash.js';
import { InMemorySpace } from '../src/core/space.js';
import { AtomKind, expr, num, str, sym, varr } from '../src/types/ast.js';

describe('InMemorySpace', () => {
  it('adds and queries atoms', () => {
    using space = new InMemorySpace();
    const atom = sym('hello');
    space.add(atom);
    expect(space.size).toBe(1);
    const results = [...space.query(sym('hello'))];
    expect(results).toHaveLength(1);
  });

  it('removes atoms', () => {
    using space = new InMemorySpace();
    const atom = sym('hello');
    space.add(atom);
    expect(space.remove(atom)).toBe(true);
    expect(space.size).toBe(0);
  });
});

describe('Hash', () => {
  it('hashes atoms consistently', () => {
    const a = sym('hello');
    const b = sym('hello');
    expect(hashAtom(a)).toBe(hashAtom(b));
  });

  it('hashes different atoms differently', () => {
    const a = sym('hello');
    const b = sym('world');
    expect(hashAtom(a)).not.toBe(hashAtom(b));
  });

  it('checks equality', () => {
    const a = sym('hello');
    const b = sym('hello');
    const c = sym('world');
    expect(equalAtoms(a, b)).toBe(true);
    expect(equalAtoms(a, c)).toBe(false);
  });

  it('hashes expressions', () => {
    const a = expr(sym('+'), num(1), num(2));
    const b = expr(sym('+'), num(1), num(2));
    expect(hashAtom(a)).toBe(hashAtom(b));
  });

  it('checks expression equality', () => {
    const a = expr(sym('+'), num(1), num(2));
    const b = expr(sym('+'), num(1), num(2));
    const c = expr(sym('+'), num(1), num(3));
    expect(equalAtoms(a, b)).toBe(true);
    expect(equalAtoms(a, c)).toBe(false);
  });

  it('checks string equality', () => {
    const a = str('hello');
    const b = str('hello');
    const c = str('world');
    expect(equalAtoms(a, b)).toBe(true);
    expect(equalAtoms(a, c)).toBe(false);
  });
});

describe('the one structural walk, under both variable policies', () => {
  it('reads a variable as a named node under equality', () => {
    expect(equalAtoms(varr('?x'), varr('?x'))).toBe(true);
    expect(equalAtoms(varr('?x'), varr('?y'))).toBe(false);
    expect(equalAtoms(varr('?x'), sym('?x'))).toBe(false);
  });

  it('reads a variable as a wildcard under matching', () => {
    expect(matchesAtom(sym('hello'), varr('?x'))).toBe(true);
    expect(matchesAtom(expr(sym('+'), num(1)), expr(sym('+'), varr('?n')))).toBe(true);
    expect(matchesAtom(varr('?x'), varr('?y'))).toBe(true);
  });

  it('does not let a wildcard widen into a different shape', () => {
    expect(matchesAtom(expr(sym('+'), num(1), num(2)), expr(sym('+'), varr('?n')))).toBe(false);
    expect(matchesAtom(sym('hello'), num(1))).toBe(false);
    expect(matchesAtom(sym('hello'), expr(sym('+'), varr('?n')))).toBe(false);
  });

  it('does not let a wildcard stand in for the operator', () => {
    expect(matchesAtom(expr(sym('*'), num(1)), expr(sym('+'), varr('?n')))).toBe(false);
  });

  it('separates the grounded operator from its arguments', () => {
    const sum = { kind: AtomKind.Grounded, op: '+', args: [num(1)] } as const;
    const product = { kind: AtomKind.Grounded, op: '*', args: [num(1)] } as const;
    expect(equalAtoms(sum, { ...product, args: [num(1)] })).toBe(false);
    expect(matchesAtom(sum, { ...product, args: [varr('?n')] })).toBe(false);
    expect(matchesAtom(sum, { kind: AtomKind.Grounded, op: '+', args: [varr('?n')] })).toBe(true);
  });
});

describe('MeTTaError', () => {
  it('carries the shared code and its own reason', () => {
    const error = new MeTTaError(MeTTaReason.UNEXPECTED_TOKEN, 'test error');
    expect(error).toBeInstanceOf(SenarsError);
    expect(error.code).toBe('METTA_ERROR');
    expect(error.reason).toBe(MeTTaReason.UNEXPECTED_TOKEN);
    expect(error.message).toContain('test error');
    expect(error.toJSON()).toMatchObject({ code: 'METTA_ERROR', name: 'MeTTaError' });
  });

  it('creates parse error', () => {
    const error = MeTTaError.parse('unexpected token', { line: 5 });
    expect(error.reason).toBe(MeTTaReason.UNEXPECTED_TOKEN);
    expect(error.message).toContain('unexpected token');
  });

  it('creates type error', () => {
    const error = MeTTaError.type('mismatch', { expected: 'number' });
    expect(error.reason).toBe(MeTTaReason.TYPE_MISMATCH);
  });

  it('creates runtime error', () => {
    const error = MeTTaError.runtime('unbound variable', { var: '$x' });
    expect(error.reason).toBe(MeTTaReason.UNBOUND_VARIABLE);
  });

  it('includes context and threads the cause', () => {
    const cause = new Error('divide by zero');
    const error = new MeTTaError(MeTTaReason.DIVISION_BY_ZERO, 'error', { divisor: 0 }, { cause });
    expect(error.context).toEqual({ divisor: 0 });
    expect(error.cause).toBe(cause);
  });
});
