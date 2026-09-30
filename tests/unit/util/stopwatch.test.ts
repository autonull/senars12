import { monotonicNow, stopwatch } from '@senars/util';
import { describe, expect, it } from 'vitest';

describe('stopwatch', () => {
  it('reads 0 before the clock advances', () => {
    let now = 1_000;
    const elapsed = stopwatch(() => now);
    expect(elapsed()).toBe(0);
    now = 1_000;
    expect(elapsed()).toBe(0);
  });

  it('accumulates across repeated reads rather than resetting', () => {
    let now = 0;
    const elapsed = stopwatch(() => now);
    now = 5;
    expect(elapsed()).toBe(5);
    now = 12;
    expect(elapsed()).toBe(12);
    expect(elapsed()).toBe(12);
  });

  it('goes negative when the wall clock is adjusted mid-measurement', () => {
    // The documented cost of the Date.now default: an NTP step backwards yields a
    // negative span. This is why latency that must never report a negative value
    // passes monotonicNow instead of relying on the default clock.
    let now = 10_000;
    const elapsed = stopwatch(() => now);
    now = 9_000;
    expect(elapsed()).toBe(-1_000);
  });

  it('gives independent stopwatches independent origins', () => {
    let now = 0;
    const first = stopwatch(() => now);
    now = 100;
    const second = stopwatch(() => now);
    expect(first()).toBe(100);
    expect(second()).toBe(0);
  });

  it('shares an injected clock between two nested spans', () => {
    let now = 0;
    const outer = stopwatch(() => now);
    now = 30;
    const inner = stopwatch(() => now);
    now = 40;
    expect(inner()).toBe(10);
    expect(outer()).toBe(40);
  });

  it('resolves fractional spans on a monotonic clock', () => {
    let now = 0;
    const elapsed = stopwatch(() => now);
    now = 0.25;
    expect(elapsed()).toBe(0.25);
  });

  it('monotonicNow advances and never rewinds', () => {
    const first = monotonicNow();
    const second = monotonicNow();
    expect(second).toBeGreaterThanOrEqual(first);
  });
});
