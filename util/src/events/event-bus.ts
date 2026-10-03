import { defaultLogger, type Logger } from '../logger.js';
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
    let bag = this.bags.get(name);
    if (!bag) {
      bag = new ListenerBag(this.logger);
      this.bags.set(name, bag);
    }
    return bag;
  }

  off(eventName: string, fn: EventReceiver<unknown>): void {
    const bag = this.bags.get(eventName);
    if (!bag) return;
    bag.off(fn);
    if (bag.size === 0) this.bags.delete(eventName);
  }

  emit<K extends keyof T>(eventName: K & string, params: T[K]): void {
    const bag = this.bags.get(eventName as string);
    if (!bag) return;
    bag.emit(params);
    if (bag.size === 0) this.bags.delete(eventName as string);
  }

  clear(): void {
    this.bags.clear();
  }

  listenerCount(eventName: string): number {
    return this.bags.get(eventName)?.size ?? 0;
  }
}
