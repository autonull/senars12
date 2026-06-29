export class EventBus {
  private handlers = new Map<string, Set<(...args: any[]) => void>>();

  on(event: string, fn: (...args: any[]) => void) {
    (this.handlers.get(event) ?? this.handlers.set(event, new Set()).get(event)!).add(fn);
  }

  off(event: string, fn: (...args: any[]) => void) {
    this.handlers.get(event)?.delete(fn);
  }

  emit(event: string, ...args: any[]) {
    this.handlers.get(event)?.forEach((fn) => fn(...args));
  }
}

export const eventBus = new EventBus();
