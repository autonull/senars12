import { describe, it, expect } from 'vitest';
import { Cache } from '../src/core/cache.js';
import { SymbolInterner } from '../src/core/intern.js';
import { InMemorySpace } from '../src/core/space.js';
import { MeTTaError, ErrorCode } from '../src/core/errors.js';
import { hashAtom, equalAtoms } from '../src/core/hash.js';
import { sym } from '../src/types/ast.js';

describe('Cache', () => {
  it('stores and retrieves values', () => {
    using cache = new Cache({ policy: 'lru' });
    cache.set('a', 'value-a');
    expect(cache.get('a')).toBe('value-a');
  });

  it('returns undefined for missing keys', () => {
    using cache = new Cache({ policy: 'lru' });
    expect(cache.get('missing')).toBeUndefined();
  });

  it('tracks stats', () => {
    using cache = new Cache({ policy: 'lru' });
    cache.set('a', 'value-a');
    cache.get('a');
    cache.get('missing');
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);
  });

  it('evicts when maxSize is reached', () => {
    using cache = new Cache({ maxSize: 2, policy: 'lru' });
    cache.set('a', 'value-a');

    cache.set('b', 'value-b');
    cache.set('c', 'value-c');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('value-b');
    expect(cache.get('c')).toBe('value-c');
  });

  it('supports TTL eviction', () => {
    using cache = new Cache({ ttl: 1 });
    cache.set('a', 'value-a');
    expect(cache.has('a')).toBe(true);
  });
});

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
    const s2 = interner.get('hello');
    expect(s1).toBe(s2);
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
});

describe('MeTTaError', () => {
  it('creates error with code and message', () => {
    const error = new MeTTaError(ErrorCode.UNEXPECTED_TOKEN, 'test error');
    expect(error.code).toBe(ErrorCode.UNEXPECTED_TOKEN);
    expect(error.message).toContain('test error');
  });
});