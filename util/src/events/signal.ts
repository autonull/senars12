import { defaultLogger, type Logger } from '../logger.js';
import { errMsg } from '../utils/error.js';
import type { EventReceiver, EventUnsubscribe } from './event-bus.js';

/**
 * One subject, any number of listeners — the unnamed case {@link EventBus} generalises.
 *
 * A throwing listener is isolated and logged rather than allowed to stop the
 * producer, and `on` returns the same {@link EventUnsubscribe} every other
 * subscription in the repository returns. The two are kept separate because
 * `EventBus` pays for a name-keyed `Map` that a single subject never reads.
 */
export class Signal<T> {
  readonly #listeners = new Set<EventReceiver<T>>();
  readonly #logger: Logger;

  constructor(logger: Logger = defaultLogger) {
    this.#logger = logger;
  }

  get size(): number {
    return this.#listeners.size;
  }

  on(receiver: EventReceiver<T>): EventUnsubscribe {
    this.#listeners.add(receiver);
    return () => {
      this.#listeners.delete(receiver);
    };
  }

  /** Detach one receiver by identity, for an interface that hands the handle back. */
  off(receiver: EventReceiver<T>): void {
    this.#listeners.delete(receiver);
  }

  emit(value: T): void {
    for (const receiver of this.#listeners) {
      try {
        receiver(value);
      } catch (e) {
        this.#logger.warn('Signal listener threw; remaining listeners still ran', {
          error: errMsg(e),
        });
      }
    }
  }

  /** Detached receivers, for a consumer that must await them itself. */
  receivers(): EventReceiver<T>[] {
    return [...this.#listeners];
  }

  clear(): void {
    this.#listeners.clear();
  }
}
