import { SlidingWindowRateLimiter } from '../../../util/src';

describe('SlidingWindowRateLimiter', () => {
  it('admits exactly the limit per window, then sheds', () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 3, windowMs: 1000, now: () => 0 });

    expect([limiter.tryAcquire(), limiter.tryAcquire(), limiter.tryAcquire()]).toEqual([
      true,
      true,
      true,
    ]);
    expect(limiter.tryAcquire()).toBe(false);
  });

  it('sheds until the displaced arrival has aged out of the window', () => {
    let now = 0;
    const limiter = new SlidingWindowRateLimiter({ limit: 2, windowMs: 1000, now: () => now });

    now = 0;
    expect(limiter.tryAcquire()).toBe(true);
    now = 100;
    expect(limiter.tryAcquire()).toBe(true);
    now = 200;
    expect(limiter.tryAcquire()).toBe(false);
    now = 1100;
    expect(limiter.tryAcquire()).toBe(true);
    now = 1200;
    expect(limiter.tryAcquire()).toBe(true);
    now = 1300;
    expect(limiter.tryAcquire()).toBe(false);
  });

  it('keeps a separate window per key', () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });

    expect(limiter.tryAcquire('a')).toBe(true);
    expect(limiter.tryAcquire('b')).toBe(true);
    expect(limiter.tryAcquire('a')).toBe(false);
    expect(limiter.tryAcquire('b')).toBe(false);
  });

  it('evicts the least recently used window rather than growing without limit', () => {
    const limiter = new SlidingWindowRateLimiter({
      limit: 1,
      windowMs: 1000,
      maxKeys: 2,
      now: () => 0,
    });

    limiter.tryAcquire('a');
    limiter.tryAcquire('b');
    limiter.tryAcquire('c');

    expect(limiter.tryAcquire('a')).toBe(true);
  });

  it('resets one key or all of them', () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });

    limiter.tryAcquire('a');
    limiter.tryAcquire('b');
    expect(limiter.tryAcquire('a')).toBe(false);

    limiter.reset('a');
    expect(limiter.tryAcquire('a')).toBe(true);
    expect(limiter.tryAcquire('b')).toBe(false);

    limiter.reset();
    expect(limiter.tryAcquire('b')).toBe(true);
  });
});
