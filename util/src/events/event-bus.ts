import { defaultLogger, type Logger } from '../logger.js';
import { getOrInsert } from '../utils/collections.js';
import { ListenerBag } from './listener-bag.js';

export type EventReceiver<T> = (params: T) => void;
export type EventUnsubscribe = () => void;

export class EventBus<T extends Record<string, unknown> = Record<string, unknown>> {
  private bags = new Map<string, ListenerBag<unknown>>();
  private readonly logger: Logger;

  constructor(logger: Logger = defaultLogger) {
    this.logger = logger;
  }

  on<K extends keyof T>(eventName: K & string, fn: EventReceiver<T[K]>): EventUnsubscribe {
    return this.#bag(eventName).on(fn as EventReceiver<unknown>);
  }

  once<K extends keyof T>(eventName: K & string, fn: EventReceiver<T[K]>): EventUnsubscribe {
    return this.#bag(eventName).once(fn as EventReceiver<unknown>);
  }

  #bag(name: string): ListenerBag<unknown> {
    return getOrInsert(this.bags, name, () => new ListenerBag(this.logger));
  }

  off<K extends keyof T>(eventName: K & string, fn: EventReceiver<T[K]>): void {
    const bag = this.bags.get(eventName);
    if (!bag) return;
    bag.off(fn as EventReceiver<unknown>);
    if (bag.size === 0) this.bags.delete(eventName);
  }

  /**
   * A signal declared with a `void` payload is emitted with no argument, so the
   * call site reads `emit('tick')` rather than `emit('tick', undefined)`. The
   * conditional tuple is what makes that optional for void signals while staying
   * required — and therefore checked — for every other one.
   */
  emit<K extends keyof T>(
    eventName: K & string,
    ...args: void extends T[K] ? [params?: T[K]] : [params: T[K]]
  ): void {
    const bag = this.bags.get(eventName as string);
    if (!bag) return;
    bag.emit(args[0]);
    if (bag.size === 0) this.bags.delete(eventName as string);
  }

  clear(): void {
    this.bags.clear();
  }

  listenerCount(eventName: string): number {
    return this.bags.get(eventName)?.size ?? 0;
  }
}
