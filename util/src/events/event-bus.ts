import type { Logger } from '../types/lifecycle.js';

export type EventReceiver<T> = (params: T) => void;
export type EventUnsubscribe = () => void;

interface Listener<T = unknown> {
  fn: EventReceiver<T>;
  once: boolean;
}

const consoleLogger: Logger = {
  debug: (msg, ctx) => console.debug(msg, ctx),
  info: (msg, ctx) => console.info(msg, ctx),
  warn: (msg, ctx) => console.warn(msg, ctx),
  error: (msg, err, ctx) => console.error(msg, err, ctx),
  scope: 'console',
  warnOnce: (key, msg, ctx) => consoleLogger.warn(`${key}: ${msg}`, ctx),
  deprecated: (oldSymbol, replacement, ctx) =>
    consoleLogger.warn(`deprecated ${oldSymbol}; use ${replacement} instead`, ctx),
  setLevel: () => {},
  getLevel: () => 'debug' as const,
  getScope: () => 'console',
};

export class EventBus<T extends Record<string, unknown> = Record<string, unknown>> {
  private listeners = new Map<string, Listener[]>();
  private readonly logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? consoleLogger;
  }

  on<K extends keyof T>(eventName: K & string, fn: EventReceiver<T[K]>): EventUnsubscribe {
    const listeners = this.listeners.get(eventName as string) ?? [];
    listeners.push({ fn: fn as unknown as EventReceiver<unknown>, once: false });
    this.listeners.set(eventName as string, listeners);
    return () => this.off(eventName as string, fn as EventReceiver<unknown>);
  }

  once<K extends keyof T>(eventName: K & string, fn: EventReceiver<T[K]>): EventUnsubscribe {
    const listeners = this.listeners.get(eventName as string) ?? [];
    listeners.push({ fn: fn as unknown as EventReceiver<unknown>, once: true });
    this.listeners.set(eventName as string, listeners);
    return () => this.off(eventName as string, fn as EventReceiver<unknown>);
  }

  off(eventName: string, fn: EventReceiver<unknown>): void {
    const listeners = this.listeners.get(eventName);
    if (!listeners) return;
    const filtered = listeners.filter((l) => l.fn !== fn);
    if (filtered.length === 0) {
      this.listeners.delete(eventName);
    } else {
      this.listeners.set(eventName, filtered);
    }
  }

  emit<K extends keyof T>(eventName: K & string, params: T[K]): void {
    const listeners = this.listeners.get(eventName as string);
    if (!listeners) return;

    for (const listener of listeners) {
      try {
        listener.fn(params);
      } catch (error) {
        this.logger.error(`Event listener error for ${eventName}:`, error as Error);
      }
    }

    const remaining = listeners.filter((l) => !l.once);
    if (remaining.length === 0) {
      this.listeners.delete(eventName as string);
    } else {
      this.listeners.set(eventName as string, remaining);
    }
  }

  clear(): void {
    this.listeners.clear();
  }

  listenerCount(eventName: string): number {
    return this.listeners.get(eventName)?.length ?? 0;
  }
}
