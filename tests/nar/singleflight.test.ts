import { describe, expect, it } from 'vitest';
import { SingleFlight } from '../../nar/src/nl/singleflight.js';

const deferred = <T>() => {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};

describe('todo7: single-flight', () => {
  it('concurrent same-key calls share one execution', async () => {
    const flight = new SingleFlight();
    let calls = 0;
    const d = deferred<string>();
    const fn = () => { calls++; return d.promise; };
    const [a, b] = [flight.run('k', fn), flight.run('k', fn)];
    expect(calls).toBe(1);
    expect(flight.size).toBe(1);
    d.resolve('ok');
    expect(await Promise.all([a, b])).toEqual(['ok', 'ok']);
    expect(flight.size).toBe(0);
  });
  it('different keys execute separately; settled keys re-execute', async () => {
    const flight = new SingleFlight();
    let calls = 0;
    const fn = () => { calls++; return Promise.resolve(calls); };
    expect(await Promise.all([flight.run('a', fn), flight.run('b', fn)])).toEqual([1, 2]);
    expect(await flight.run('a', fn)).toBe(3);
  });
  it('rejection clears the slot so retries are possible', async () => {
    const flight = new SingleFlight();
    let calls = 0;
    const failing = () => { calls++; return Promise.reject(new Error('lm down')); };
    await expect(flight.run('k', failing)).rejects.toThrow('lm down');
    await expect(flight.run('k', failing)).rejects.toThrow('lm down');
    expect(calls).toBe(2);
    expect(flight.size).toBe(0);
  });
});
