import { defaultLogger, type Logger } from '../logger.js';
import { errMsg } from '../utils/error.js';
import type { EventReceiver, EventUnsubscribe } from './event-bus.js';

interface Listener<T> {
  fn: EventReceiver<T>;
  once: boolean;
}

/**
 * One subject's listener set — the shared core of {@link EventBus} and
 * {@link Signal}. A throwing listener is isolated and logged rather than
 * allowed to stop the producer.
 */
export class ListenerBag<T> {
  readonly #listeners = new Set<Listener<T>>();
  readonly #logger: Logger;

  constructor(logger: Logger = defaultLogger) {
    this.#logger = logger;
  }

  get size(): number {
    return this.#listeners.size;
  }

  on(fn: EventReceiver<T>): EventUnsubscribe {
    return this.#add(fn, false);
  }

  once(fn: EventReceiver<T>): EventUnsubscribe {
    return this.#add(fn, true);
  }

  #add(fn: EventReceiver<T>, once: boolean): EventUnsubscribe {
    const listener: Listener<T> = { fn, once };
    this.#listeners.add(listener);
    return () => this.off(fn);
  }

  off(fn: EventReceiver<T>): void {
    for (const listener of this.#listeners) {
      if (listener.fn === fn) this.#listeners.delete(listener);
    }
  }

  emit(value: T): void {
    for (const listener of [...this.#listeners]) {
      try {
        listener.fn(value);
      } catch (e) {
        this.#logger.warn('Event listener threw; remaining listeners still ran', {
          error: errMsg(e),
        });
      } finally {
        if (listener.once) this.#listeners.delete(listener);
      }
    }
  }

  receivers(): EventReceiver<T>[] {
    return [...this.#listeners].map((l) => l.fn);
  }

  clear(): void {
    this.#listeners.clear();
  }
}
