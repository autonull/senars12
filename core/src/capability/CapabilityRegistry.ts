import type { EventLog } from '../eventlog/EventLog.js';
import type { Capability } from './Capability.js';
import type { BackendManifest } from '../backend/Backend.js';
import type { CognitiveEvent } from '../events/EventTypes.js';

export interface CapabilityRegistry {
  providers(cap: Capability): ReadonlySet<string>;
  capabilitiesOf(backendId: string): ReadonlySet<Capability>;
  compose(required: ReadonlySet<Capability>): string[][];
  subscribe(): AsyncIterable<CapabilityRegistry>;
}

export class CapabilityRegistryImpl implements CapabilityRegistry {
  #providers: Map<Capability, Set<string>> = new Map();
  #backendCaps: Map<string, Set<Capability>> = new Map();
  #subscribers: Set<(registry: CapabilityRegistry) => void> = new Set();
  #initialized = false;

  constructor(private readonly eventLog: EventLog) {}

  async initialize(): Promise<void> {
    if (this.#initialized) return;
    for await (const event of this.eventLog.subscribe({ types: ['backend.registered'] })) {
      const manifest = (event.payload as { manifest: BackendManifest }).manifest;
      this.#registerBackend(manifest);
    }
    this.#initialized = true;
  }

  get log(): EventLog {
    return this.eventLog;
  }

  #registerBackend(manifest: BackendManifest): void {
    this.#backendCaps.set(manifest.id, new Set(manifest.provides));
    for (const cap of manifest.provides) {
      let set = this.#providers.get(cap);
      if (!set) {
        set = new Set();
        this.#providers.set(cap, set);
      }
      set.add(manifest.id);
    }
    this.#notify();
  }

  providers(cap: Capability): ReadonlySet<string> {
    return this.#providers.get(cap) ?? new Set();
  }

  capabilitiesOf(backendId: string): ReadonlySet<Capability> {
    return this.#backendCaps.get(backendId) ?? new Set();
  }

  compose(required: ReadonlySet<Capability>): string[][] {
    const requiredList = [...required];
    const results: string[][] = [];
    const backendIds: string[] = [...this.#backendCaps.keys()];

    const backtrack = (start: number, current: string[], covered: Set<Capability>): void => {
      if (covered.size >= requiredList.length) {
        results.push([...current]);
        return;
      }
      for (let i = start; i < backendIds.length; i++) {
        const id = backendIds[i];
        if (!id) continue;
        const caps = this.#backendCaps.get(id);
        if (!caps) continue;
        const newCovered = new Set(covered);
        for (const cap of caps) {
          if (required.has(cap)) newCovered.add(cap);
        }
        if (newCovered.size > covered.size) {
          current.push(id);
          backtrack(i + 1, current, newCovered);
          current.pop();
        }
      }
    };

    backtrack(0, [], new Set());
    return results;
  }

  subscribe(): AsyncIterable<CapabilityRegistry> {
    const queue: CapabilityRegistry[] = [];
    let resolve: ((value: IteratorResult<CapabilityRegistry>) => void) | null = null;
    let closed = false;
    const subscribers = this.#subscribers;

    const subscriber = (registry: CapabilityRegistry) => {
      queue.push(registry);
      if (resolve) {
        const res = resolve;
        resolve = null;
        const next = queue.shift();
        if (next) res({ value: next, done: false });
      }
    };
    subscribers.add(subscriber);

    return {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<CapabilityRegistry>> {
            if (queue.length > 0) {
              const next = queue.shift();
              if (next) return { value: next, done: false };
            }
            if (closed) return { value: undefined, done: true };
            return new Promise((res) => { resolve = res; });
          },
          async return(): Promise<IteratorResult<CapabilityRegistry>> {
            closed = true;
            subscribers.delete(subscriber);
            return { value: undefined, done: true };
          },
        };
      },
    };
  }

  #notify(): void {
    for (const sub of this.#subscribers) {
      sub(this);
    }
  }
}