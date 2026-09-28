import { describe, expect, test } from 'vitest';

import { TermMap, TermSet } from '../../../nar/src/terms';
import { TermBuilder } from '../../../nar/src/terms/factory.js';
import type { AtomicTerm, CompoundTerm } from '../../../nar/src/terms/types.js';

/** Locally-built terms are not frozen or factory-cached, so collections must
 *  fall back to structural identity rather than reference identity. */
const rawAtom = (symbol: string): AtomicTerm =>
  ({ kind: 'atom', symbol, toString: () => symbol }) as AtomicTerm;
const rawCompound = (kind: string, ...args: AtomicTerm[]): CompoundTerm =>
  ({ kind, args, toString: () => `(${kind})` }) as unknown as CompoundTerm;

describe('TermMap', () => {
  test('addresses structurally equal non-frozen terms as one entry', () => {
    const map = new TermMap<number>();
    map.set(rawAtom('bird'), 1);
    expect(map.get(rawAtom('bird'))).toBe(1);
    expect(map.has(rawAtom('bird'))).toBe(true);
    expect(map.size).toBe(1);
  });

  test('distinguishes structurally different terms', () => {
    const map = new TermMap<string>();
    map.set(rawCompound('conjunction', rawAtom('a'), rawAtom('b')), 'ab');
    map.set(rawCompound('conjunction', rawAtom('a'), rawAtom('c')), 'ac');
    expect(map.size).toBe(2);
    expect(map.get(rawCompound('conjunction', rawAtom('a'), rawAtom('b')))).toBe('ab');
  });

  test('overwrites in place without growing', () => {
    const map = new TermMap<number>();
    map.set(rawAtom('x'), 1);
    map.set(rawAtom('x'), 2);
    expect(map.size).toBe(1);
    expect(map.get(rawAtom('x'))).toBe(2);
  });

  test('keeps indices valid across deletes', () => {
    const map = new TermMap<string>();
    for (const symbol of ['a', 'b', 'c', 'd']) map.set(rawAtom(symbol), symbol);

    expect(map.delete(rawAtom('b'))).toBe(true);
    expect(map.size).toBe(3);
    expect(map.get(rawAtom('a'))).toBe('a');
    expect(map.get(rawAtom('c'))).toBe('c');
    expect(map.get(rawAtom('d'))).toBe('d');
    expect(map.has(rawAtom('b'))).toBe(false);
  });

  test('reports a miss for an absent term', () => {
    expect(new TermMap<number>().get(rawAtom('nope'))).toBeUndefined();
    expect(new TermMap<number>().delete(rawAtom('nope'))).toBe(false);
  });

  test('clears storage and lookups together', () => {
    const map = new TermMap<number>();
    map.set(rawAtom('a'), 1);
    map.clear();
    expect(map.size).toBe(0);
    expect(map.get(rawAtom('a'))).toBeUndefined();
  });

  test('mixes factory-cached and locally-built terms', () => {
    const map = new TermMap<number>();
    map.set(TermBuilder.atom('bird'), 1);
    expect(map.get(rawAtom('bird'))).toBe(1);
    expect(map.get(TermBuilder.atom('bird'))).toBe(1);
  });
});

describe('TermSet', () => {
  test('holds one entry per structural identity', () => {
    const set = new TermSet();
    set.add(rawAtom('a'));
    set.add(rawAtom('a'));
    expect(set.size).toBe(1);
    expect(set.has(rawAtom('a'))).toBe(true);
  });

  test('deletes structurally equal terms', () => {
    const set = new TermSet();
    set.add(rawAtom('a'));
    set.add(rawAtom('b'));
    expect(set.delete(rawAtom('a'))).toBe(true);
    expect(set.has(rawAtom('a'))).toBe(false);
    expect(set.toArray().map((t) => (t as AtomicTerm).symbol)).toEqual(['b']);
  });
});
