import { describe, expect, it } from 'vitest';
import { ErrorCode, MeTTaError } from '../src/core/errors.js';
import { equalAtoms, hashAtom } from '../src/core/hash.js';
import { SymbolInterner } from '../src/core/intern.js';
import { InMemorySpace } from '../src/core/space.js';
import { expr, num, str, sym } from '../src/types/ast.js';

describe('SymbolInterner', () => {
  it('interns symbols', () => {
    using interner = new SymbolInterner();
    const s1 = interner.intern('hello');
    const s2 = interner.intern('hello');
    expect(s1).toBe(s2);
  });

  it('returns existing symbol', () => {
    using interner = new SymbolInterner();
    const s1 = interner.intern('hello');
    expect(interner.get('hello')).toBe(s1);
    expect(interner.has('hello')).toBe(true);
  });

  it('evicts least-recently-used names past capacity', () => {
    using interner = new SymbolInterner({ maxSize: 1 });
    interner.intern('a');
    interner.intern('b');
    expect(interner.has('a')).toBe(false);
    expect(interner.has('b')).toBe(true);
  });
});

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

describe('MeTTaError', () => {
  it('creates error with code and message', () => {
    const error = new MeTTaError(ErrorCode.UNEXPECTED_TOKEN, 'test error');
    expect(error.code).toBe(ErrorCode.UNEXPECTED_TOKEN);
    expect(error.message).toContain('test error');
  });

  it('creates parse error', () => {
    const error = MeTTaError.parse('unexpected token', { line: 5 });
    expect(error.code).toBe(ErrorCode.UNEXPECTED_TOKEN);
    expect(error.message).toContain('unexpected token');
  });

  it('creates type error', () => {
    const error = MeTTaError.type('mismatch', { expected: 'number' });
    expect(error.code).toBe(ErrorCode.TYPE_MISMATCH);
  });

  it('creates runtime error', () => {
    const error = MeTTaError.runtime('unbound variable', { var: '$x' });
    expect(error.code).toBe(ErrorCode.UNBOUND_VARIABLE);
  });

  it('includes context in error', () => {
    const error = new MeTTaError(ErrorCode.DIVISION_BY_ZERO, 'error', { divisor: 0 });
    expect(error.context).toEqual({ divisor: 0 });
  });
});
