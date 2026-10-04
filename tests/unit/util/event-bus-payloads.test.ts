import { createLogger, EventBus } from '@senars/util';
import { describe, expect, it, vi } from 'vitest';

interface Signals extends Record<string, unknown> {
  tick: { n: number };
  done: void;
}

/** A real logger with only `warn` observed: isolation is asserted by *logging*. */
const observingLogger = () => {
  const logger = createLogger({ scope: 'test' });
  const warn = vi.spyOn(logger, 'warn').mockImplementation(() => logger);
  return { logger, warn };
};

describe('EventBus payload typing', () => {
  it('emits a void signal with no argument', () => {
    const bus = new EventBus<Signals>();
    const seen = vi.fn();
    bus.on('done', seen);
    bus.emit('done');
    expect(seen).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it('delivers the declared payload shape', () => {
    const bus = new EventBus<Signals>();
    const seen = vi.fn<(p: { n: number }) => void>();
    bus.on('tick', seen);
    bus.emit('tick', { n: 7 });
    expect(seen).toHaveBeenCalledExactlyOnceWith({ n: 7 });
  });

  it('an unsubscribed listener stops receiving', () => {
    const bus = new EventBus<Signals>();
    const seen = vi.fn();
    const off = bus.on('tick', seen);
    bus.emit('tick', { n: 1 });
    off();
    bus.emit('tick', { n: 2 });
    expect(seen).toHaveBeenCalledExactlyOnceWith({ n: 1 });
  });

  it('once fires a single time', () => {
    const bus = new EventBus<Signals>();
    const seen = vi.fn();
    bus.once('tick', seen);
    bus.emit('tick', { n: 1 });
    bus.emit('tick', { n: 2 });
    expect(seen).toHaveBeenCalledExactlyOnceWith({ n: 1 });
  });

  it('off removes the listener it is given', () => {
    const bus = new EventBus<Signals>();
    const seen = vi.fn();
    bus.on('tick', seen);
    bus.off('tick', seen);
    bus.emit('tick', { n: 1 });
    expect(seen).not.toHaveBeenCalled();
  });

  it('isolates a throwing listener so the rest of the set still runs', () => {
    const { logger, warn } = observingLogger();
    const bus = new EventBus<Signals>(logger);
    const after = vi.fn();
    bus.on('tick', () => {
      throw new Error('listener blew up');
    });
    bus.on('tick', after);

    expect(() => bus.emit('tick', { n: 1 })).not.toThrow();
    expect(after).toHaveBeenCalledExactlyOnceWith({ n: 1 });
    expect(warn).toHaveBeenCalled();
  });

  it('emitting with no listeners is a no-op', () => {
    const bus = new EventBus<Signals>();
    expect(() => bus.emit('tick', { n: 1 })).not.toThrow();
    expect(bus.listenerCount('tick')).toBe(0);
  });

  it('clear removes every subscription', () => {
    const bus = new EventBus<Signals>();
    const seen = vi.fn();
    bus.on('tick', seen);
    bus.clear();
    bus.emit('tick', { n: 1 });
    expect(seen).not.toHaveBeenCalled();
  });
});
