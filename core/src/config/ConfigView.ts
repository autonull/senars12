import type { EventLog } from '../eventlog/EventLog.js';
import type { CognitiveEvent } from '../CognitiveEvent.js';
import type { ConfigView, ConfigEvent } from './Config.js';

export class ConfigViewImpl implements ConfigView {
  #log: EventLog;
  #cache: Map<string, unknown> = new Map();
  #subscribers: Map<string, Set<(event: ConfigEvent) => void>> = new Map();

  constructor(log: EventLog) {
    this.#log = log;
    this.#loadExistingConfig();
  }

  async #loadExistingConfig(): Promise<void> {
    const events = this.#log.getRange('0');
    for (const event of await events) {
      if (event.type === 'config.set') {
        const { path, value } = event.payload as { path: string; value: unknown };
        this.#cache.set(path, value);
      } else if (event.type === 'config.delete') {
        const { path } = event.payload as { path: string };
        this.#cache.delete(path);
      }
    }
  }

  get<T>(path: string): T | undefined {
    return this.#cache.get(path) as T | undefined;
  }

  getAll(prefix: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.#cache) {
      if (key.startsWith(prefix)) result[key] = value;
    }
    return result;
  }

  subscribe(prefix: string): AsyncIterable<ConfigEvent> {
    const queue: ConfigEvent[] = [];
    const resolvers: Array<(value: IteratorResult<ConfigEvent>) => void> = [];
    let closed = false;
    const subscribers = this.#subscribers;

    const handler = (event: ConfigEvent) => {
      if (event.payload.path.startsWith(prefix)) {
        queue.push(event);
        if (resolvers.length > 0) {
          const next = queue.shift();
          const resolver = resolvers.shift();
          if (next && resolver) resolver({ value: next, done: false });
        }
      }
    };

    const handlers = subscribers.get(prefix) ?? new Set();
    handlers.add(handler);
    subscribers.set(prefix, handlers);

    return {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<ConfigEvent>> {
            if (queue.length > 0) {
              const next = queue.shift();
              if (next) return { value: next, done: false };
            }
            if (closed) return { value: undefined, done: true };
            return new Promise<IteratorResult<ConfigEvent>>((res) => {
              resolvers.push(res);
            });
          },
          async return(): Promise<IteratorResult<ConfigEvent>> {
            closed = true;
            const h = subscribers.get(prefix);
            if (h) h.delete(handler);
            return { value: undefined, done: true };
          },
        };
      },
    };
  }
}