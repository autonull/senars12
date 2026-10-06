import { deepEqual, deepFreeze, thaw } from '@senars/util';
import { describe, expect, it } from 'vitest';

describe('thaw', () => {
  const frozen = deepFreeze({
    strategies: { lmRule: { type: 'priority', weight: 1 }, derivation: { type: 'focused' } },
    slots: ['focus', 'review'],
    n: 0,
    nothing: null,
  });

  it('unfreezes every level, so a nested write lands on the copy', () => {
    const copy = thaw(frozen);
    copy.strategies.lmRule.weight = 0.5;
    copy.slots.push('block');
    expect(copy.strategies.lmRule.weight).toBe(0.5);
    expect(copy.slots).toHaveLength(3);
  });

  it('leaves the frozen original untouched — that is the whole reason to copy', () => {
    thaw(frozen).strategies.derivation.type = 'broad';
    expect(frozen.strategies.derivation.type).toBe('focused');
    expect(Object.isFrozen(frozen.strategies)).toBe(true);
  });

  it('copies structure, not identity: no node is shared with the original', () => {
    const copy = thaw(frozen);
    expect(copy).not.toBe(frozen);
    expect(copy.strategies).not.toBe(frozen.strategies);
    expect(copy.strategies.lmRule).not.toBe(frozen.strategies.lmRule);
    expect(copy.slots).not.toBe(frozen.slots);
    expect(deepEqual(copy, frozen)).toBe(true);
  });

  it('keeps what a serialising clone would drop', () => {
    const symbol = Symbol('tag');
    const fn = (): number => 1;
    const source = deepFreeze({ undef: undefined, symbol, fn });
    const copy = thaw(source) as Record<string, unknown>;

    expect('undef' in copy).toBe(true);
    expect(copy.symbol).toBe(symbol);
    expect(copy.fn).toBe(fn);
  });

  it('shares a value whose state is not in its own properties', () => {
    class Counter {
      steps = 0;
    }
    const counter = new Counter();
    const when = new Date(0);
    const copy = thaw(deepFreeze({ counter, when, set: new Set([1]) }));

    expect(copy.counter).toBe(counter);
    expect(copy.when).toBe(when);
    expect(copy.when.getTime()).toBe(0);
    expect(copy.set.has(1)).toBe(true);
  });

  it('passes primitives through rather than boxing them', () => {
    expect(thaw(7)).toBe(7);
    expect(thaw('x')).toBe('x');
    expect(thaw(null)).toBeNull();
    expect(thaw(undefined)).toBeUndefined();
  });
});
