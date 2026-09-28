import { PushQueue } from '@senars/util/events';
import type { ConfigEvent, ConfigView } from '@senars/util/config';
import type { EventLog } from '../eventlog/EventLog.js';

export class ConfigViewImpl implements ConfigView {
  #log: EventLog;
  #cache: Map<string, unknown> = new Map();
  #subscribers: Map<string, Set<(event: ConfigEvent) => void>> = new Map();

  constructor(log: EventLog) {
    this.#log = log;
    this.#loadExistingConfig();
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
    const queue = new PushQueue<ConfigEvent>();
    const subscribers = this.#subscribers;

    const handler = (event: ConfigEvent) => {
      if (event.payload.path.startsWith(prefix)) queue.push(event);
    };

    const handlers = subscribers.get(prefix) ?? new Set();
    handlers.add(handler);
    subscribers.set(prefix, handlers);

    return {
      [Symbol.asyncIterator]: () => ({
        next: () => queue.next(),
        return: async () => {
          queue.close();
          subscribers.get(prefix)?.delete(handler);
          return { value: undefined, done: true };
        },
      }),
    };
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
}
