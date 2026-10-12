import { describe, expect, it } from 'vitest';
import {
  createRegistry,
  createIdRegistry,
  type Registry,
} from '../../src/client/core/registry.js';

describe('createRegistry (E2)', () => {
  it('registers and retrieves values by key', () => {
    const reg = createRegistry((v: { id: string }) => v.id);
    reg.register({ id: 'a', value: 1 });
    reg.register({ id: 'b', value: 2 });
    expect(reg.get('a')).toEqual({ id: 'a', value: 1 });
    expect(reg.get('b')).toEqual({ id: 'b', value: 2 });
    expect(reg.get('c')).toBeUndefined();
  });

  it('returns all values in registration order', () => {
    const reg = createRegistry((v: { id: string }) => v.id);
    reg.register({ id: 'a', value: 1 });
    reg.register({ id: 'b', value: 2 });
    expect(reg.all()).toEqual([{ id: 'a', value: 1 }, { id: 'b', value: 2 }]);
  });

  it('reports has/size correctly', () => {
    const reg = createRegistry((v: { id: string }) => v.id);
    expect(reg.has('a')).toBe(false);
    expect(reg.size).toBe(0);
    reg.register({ id: 'a', value: 1 });
    expect(reg.has('a')).toBe(true);
    expect(reg.size).toBe(1);
  });

  it('allows duplicate keys by default (silent overwrite)', () => {
    const reg = createRegistry((v: { id: string }) => v.id);
    reg.register({ id: 'a', value: 1 });
    reg.register({ id: 'a', value: 2 });
    expect(reg.get('a')?.value).toBe(2);
    expect(reg.size).toBe(1);
  });

  it('throws on duplicate when unique: true', () => {
    const reg = createRegistry((v: { id: string }) => v.id, { unique: true });
    reg.register({ id: 'a', value: 1 });
    expect(() => reg.register({ id: 'a', value: 2 })).toThrow('Duplicate registration for key: a');
  });

  it('supports iteration', () => {
    const reg = createRegistry((v: { id: string }) => v.id);
    reg.register({ id: 'a', value: 1 });
    reg.register({ id: 'b', value: 2 });
    const iterated = [...reg];
    expect(iterated).toEqual([{ id: 'a', value: 1 }, { id: 'b', value: 2 }]);
  });

  it('createIdRegistry keys by id field', () => {
    const reg = createIdRegistry<{ id: string; label: string }>();
    reg.register({ id: 'foo', label: 'Foo' });
    expect(reg.get('foo')).toEqual({ id: 'foo', label: 'Foo' });
  });

  it('reset clears the registry', () => {
    const reg = createRegistry((v: { id: string }) => v.id);
    reg.register({ id: 'a', value: 1 });
    reg.reset();
    expect(reg.size).toBe(0);
    expect(reg.has('a')).toBe(false);
  });
});