export interface EventMap {
  [key: string]: unknown;
}

export type EventReceiver<T> = (params: T) => void;
export type EventUnsubscribe = () => void;

interface Listener<T = unknown> {
  fn: EventReceiver<T>;
  once: boolean;
}

export class EventBus<T extends EventMap = EventMap> {
  private listeners = new Map<string, Listener<any>[]>();

  on<K extends keyof T>(eventName: K & string, fn: EventReceiver<T[K]>): EventUnsubscribe {
    const listeners = this.listeners.get(eventName as string) ?? [];
    listeners.push({ fn: fn as any, once: false });
    this.listeners.set(eventName as string, listeners);
    return () => this.off(eventName as string, fn as EventReceiver<unknown>);
  }

  once<K extends keyof T>(eventName: K & string, fn: EventReceiver<T[K]>): EventUnsubscribe {
    const listeners = this.listeners.get(eventName as string) ?? [];
    listeners.push({ fn: fn as any, once: true });
    this.listeners.set(eventName as string, listeners);
    return () => this.off(eventName as string, fn as EventReceiver<unknown>);
  }

  off(eventName: string, fn: EventReceiver<unknown>): void {
    const listeners = this.listeners.get(eventName);
    if (!listeners) return;
    const filtered = listeners.filter(l => l.fn !== fn);
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
      listener.fn(params);
    }

    const remaining = listeners.filter(l => !l.once);
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

export const globalEventBus = new EventBus();
