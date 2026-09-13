import { EventBus } from '@senars/util/events';
import { describe, expect, it, vi } from 'vitest';

interface TestEvents extends Record<string, unknown> {
  ping: { value: number };
  done: { ok: boolean };
}

describe('EventBus', () => {
  it('delivers emitted events to on() listeners', () => {
    const bus = new EventBus<TestEvents>();
    const received: number[] = [];
    bus.on('ping', (p) => received.push(p.value));
    bus.emit('ping', { value: 42 });
    expect(received).toEqual([42]);
  });

  it('supports multiple listeners for the same event', () => {
    const bus = new EventBus<TestEvents>();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('done', a);
    bus.on('done', b);
    bus.emit('done', { ok: true });
    expect(a).toHaveBeenCalledWith({ ok: true });
    expect(b).toHaveBeenCalledWith({ ok: true });
  });

  it('once() listeners fire a single time then auto-remove', () => {
    const bus = new EventBus<TestEvents>();
    const fn = vi.fn();
    bus.once('ping', fn);
    bus.emit('ping', { value: 1 });
    bus.emit('ping', { value: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ value: 1 });
    expect(bus.listenerCount('ping')).toBe(0);
  });

  it('off() unsubscribes a listener', () => {
    const bus = new EventBus<TestEvents>();
    const fn = vi.fn();
    const unsub = bus.on('ping', fn);
    unsub();
    bus.emit('ping', { value: 9 });
    expect(fn).not.toHaveBeenCalled();
    expect(bus.listenerCount('ping')).toBe(0);
  });

  it('emit returns silently for events with no listeners', () => {
    const bus = new EventBus<TestEvents>();
    expect(() => bus.emit('ping', { value: 1 })).not.toThrow();
  });

  it('isolates listener errors and continues delivery', () => {
    const bus = new EventBus<TestEvents>();
    const good = vi.fn();
    bus.on('ping', () => {
      throw new Error('boom');
    });
    bus.on('ping', good);
    bus.emit('ping', { value: 5 });
    expect(good).toHaveBeenCalledWith({ value: 5 });
  });

  it('clear() removes all listeners', () => {
    const bus = new EventBus<TestEvents>();
    bus.on('ping', vi.fn());
    bus.on('done', vi.fn());
    bus.clear();
    expect(bus.listenerCount('ping')).toBe(0);
    expect(bus.listenerCount('done')).toBe(0);
  });

  it('reports listener counts', () => {
    const bus = new EventBus<TestEvents>();
    expect(bus.listenerCount('ping')).toBe(0);
    bus.on('ping', vi.fn());
    bus.on('ping', vi.fn());
    expect(bus.listenerCount('ping')).toBe(2);
  });
});
