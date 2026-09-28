/** Minimal pub-sub for cross-component UI signals; `on` returns its own unsubscriber. */
export class EventBus {
  // biome-ignore lint/suspicious/noExplicitAny: UI signals are untyped by design
  readonly #handlers = new Map<string, Set<(...args: any[]) => void>>();

  // biome-ignore lint/suspicious/noExplicitAny: UI signals are untyped by design
  on(event: string, fn: (...args: any[]) => void): () => void {
    const set = this.#handlers.get(event) ?? new Set<(...args: any[]) => void>();
    set.add(fn);
    this.#handlers.set(event, set);
    return () => this.off(event, fn);
  }

  // biome-ignore lint/suspicious/noExplicitAny: UI signals are untyped by design
  off(event: string, fn: (...args: any[]) => void): void {
    const set = this.#handlers.get(event);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) this.#handlers.delete(event);
  }

  // biome-ignore lint/suspicious/noExplicitAny: UI signals are untyped by design
  emit(event: string, ...args: any[]): void {
    for (const fn of [...(this.#handlers.get(event) ?? [])]) fn(...args);
  }
}

export const eventBus = new EventBus();
