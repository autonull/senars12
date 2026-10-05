import { describe, expect, it } from 'vitest';
import { Signal } from '@senars/util';

const collector = (log: string[], label: string) => (value: string) =>
  log.push(`${label}:${value}`);

describe('Signal', () => {
  it('fans a value out to every listener', () => {
    const log: string[] = [];
    const signal = new Signal<string>();
    signal.on(collector(log, 'a'));
    signal.on(collector(log, 'b'));

    signal.emit('x');

    expect(log).toEqual(['a:x', 'b:x']);
    expect(signal.size).toBe(2);
  });

  it('unsubscribes only the receiver that was returned', () => {
    const log: string[] = [];
    const signal = new Signal<string>();
    signal.on(collector(log, 'a'));
    const offB = signal.on(collector(log, 'b'));

    offB();
    signal.emit('x');

    expect(log).toEqual(['a:x']);
    expect(signal.size).toBe(1);
  });

  it('off detaches by identity', () => {
    const log: string[] = [];
    const signal = new Signal<string>();
    const listener = collector(log, 'a');
    signal.on(listener);
    signal.on(collector(log, 'b'));

    signal.off(listener);
    signal.emit('x');

    expect(log).toEqual(['b:x']);
  });

  it('a throwing listener does not stop the ones after it', () => {
    const log: string[] = [];
    const signal = new Signal<string>();
    signal.on(() => {
      throw new Error('boom');
    });
    signal.on(collector(log, 'b'));

    expect(() => signal.emit('x')).not.toThrow();
    expect(log).toEqual(['b:x']);
  });

  it('unsubscribing from inside a listener takes effect immediately', () => {
    const log: string[] = [];
    const signal = new Signal<string>();
    const offB = signal.on(collector(log, 'b'));
    signal.on(() => offB());
    signal.on(collector(log, 'c'));

    signal.emit('x');
    signal.emit('y');

    expect(log).toEqual(['b:x', 'c:x', 'c:y']);
  });

  it('receivers is a detached copy, safe to mutate while running', () => {
    const signal = new Signal<string>();
    const receiver = collector([], 'a');
    signal.on(receiver);

    const snapshot = signal.receivers();
    signal.off(receiver);

    expect(snapshot).toHaveLength(1);
    expect(signal.size).toBe(0);
  });

  it('clear detaches everything', () => {
    const log: string[] = [];
    const signal = new Signal<string>();
    signal.on(collector(log, 'a'));
    signal.clear();
    signal.emit('x');

    expect(log).toEqual([]);
  });
});
