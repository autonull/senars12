import { createThrottle, Throttle, throttleGenerator } from '@senars/util/utils/throttle';
import { describe, expect, it } from 'vitest';

describe('Throttle', () => {
  it('starts with burst tokens available', () => {
    const t = new Throttle({ intervalMs: 100, burst: 3 });
    expect(t.getAvailable()).toBe(3);
  });

  it('consumes a token on acquire', async () => {
    const t = new Throttle({ intervalMs: 100, burst: 2 });
    await t.acquire();
    expect(t.getAvailable()).toBe(1);
  });

  it('refills tokens after the interval elapses', async () => {
    const t = new Throttle({ intervalMs: 10, burst: 1 });
    await t.acquire();
    expect(t.getAvailable()).toBe(0);
    await new Promise((r) => setTimeout(r, 25));
    expect(t.getAvailable()).toBe(1);
  });

  it('caps tokens at burst after sustained idle', async () => {
    const t = new Throttle({ intervalMs: 5, burst: 2 });
    await t.acquire();
    await t.acquire();
    await new Promise((r) => setTimeout(r, 30));
    expect(t.getAvailable()).toBe(2);
  });

  it('reset restores full burst', async () => {
    const t = new Throttle({ intervalMs: 100, burst: 2 });
    await t.acquire();
    t.reset();
    expect(t.getAvailable()).toBe(2);
  });

  it('createThrottle is a factory for Throttle', () => {
    const t = createThrottle({ burst: 1 });
    expect(t).toBeInstanceOf(Throttle);
  });
});

describe('throttleGenerator', () => {
  it('yields all values from the source generator', async () => {
    async function* src() {
      for (let i = 0; i < 3; i++) yield i;
    }
    const out: number[] = [];
    for await (const v of throttleGenerator(src(), 0)) {
      out.push(v);
    }
    expect(out).toEqual([0, 1, 2]);
  });

  it('stops early when shouldStop returns true', async () => {
    async function* src() {
      for (let i = 0; i < 10; i++) yield i;
    }
    const out: number[] = [];
    for await (const v of throttleGenerator(src(), 0, () => out.length >= 2)) {
      out.push(v);
    }
    expect(out).toEqual([0, 1]);
  });
});
