import { defaultLogger, type Logger } from '../logger.js';
import type { EventReceiver, EventUnsubscribe } from './event-bus.js';
import { ListenerBag } from './listener-bag.js';

/**
 * One subject, any number of listeners — the unnamed case {@link EventBus} generalises.
 *
 * The two are kept separate because `EventBus` pays for a name-keyed `Map` that
 * a single subject never reads.
 */
export class Signal<T> {
  readonly #bag: ListenerBag<T>;

  constructor(logger: Logger = defaultLogger) {
    this.#bag = new ListenerBag(logger);
  }

  get size(): number {
    return this.#bag.size;
  }

  on(receiver: EventReceiver<T>): EventUnsubscribe {
    return this.#bag.on(receiver);
  }

  off(receiver: EventReceiver<T>): void {
    this.#bag.off(receiver);
  }

  emit(value: T): void {
    this.#bag.emit(value);
  }

  receivers(): EventReceiver<T>[] {
    return this.#bag.receivers();
  }

  clear(): void {
    this.#bag.clear();
  }
}
