import type { Term } from '../../terms';
import { termsEqual } from '../../terms';
import type { LinkEntry } from './types.js';

export class LinkBag {
  private readonly capacity: number;
  private readonly items: Map<string, LinkEntry>;
  private priorityIndex: Map<string, number>;
  private accessTimes: Map<string, number>;
  private readonly onRemoved?: (entry: LinkEntry) => void;

  constructor(
    capacity: number,
    private readonly forgetPolicy: 'priority' | 'lru' | 'fifo' | 'random',
    onRemoved?: (entry: LinkEntry) => void
  ) {
    this.capacity = capacity;
    this.items = new Map();
    this.priorityIndex = new Map();
    this.accessTimes = new Map();
    this.onRemoved = onRemoved;
  }

  get size(): number {
    return this.items.size;
  }

  pressure(): number {
    return this.capacity === 0 ? 1 : Math.min(1, this.items.size / this.capacity);
  }

  add(entry: LinkEntry): boolean {
    if (this.items.has(entry.id)) {
      return false;
    }

    while (this.size >= this.capacity && this.size > 0) {
      const victim = this.selectVictimId();
      if (!victim) break;
      this.remove(victim);
    }

    if (this.size >= this.capacity) {
      return false;
    }

    this.items.set(entry.id, entry);
    this.priorityIndex.set(entry.id, entry.priority);
    this.accessTimes.set(entry.id, entry.lastAccessedAt);
    return true;
  }

  remove(id: string): boolean {
    const entry = this.items.get(id);
    if (!entry) return false;

    if (this.onRemoved) {
      this.onRemoved(entry);
    }

    this.items.delete(id);
    this.priorityIndex.delete(id);
    this.accessTimes.delete(id);
    return true;
  }

  get(id: string): LinkEntry | undefined {
    const entry = this.items.get(id);
    if (entry) {
      entry.lastAccessedAt = Date.now();
      this.accessTimes.set(id, entry.lastAccessedAt);
    }
    return entry;
  }

  peekLowest(): LinkEntry | undefined {
    const victimId = this.selectVictimId();
    return victimId ? this.items.get(victimId) : undefined;
  }

  applyDecay(decayRate: number): void {
    const toRemove: string[] = [];
    const minPriority = 0.01;

    for (const [id, entry] of this.items) {
      entry.priority = Math.max(0, entry.priority * (1 - decayRate));
      this.priorityIndex.set(id, entry.priority);

      if (entry.priority < minPriority) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.remove(id);
    }
  }

  clear(): void {
    this.items.clear();
    this.priorityIndex.clear();
    this.accessTimes.clear();
  }

  *entries(): IterableIterator<[LinkEntry, number]> {
    for (const entry of this.items.values()) {
      yield [entry, entry.priority];
    }
  }

  forEachLink(fn: (entry: LinkEntry) => void): void {
    for (const entry of this.items.values()) {
      fn(entry);
    }
  }

  getLinks(): LinkEntry[] {
    return Array.from(this.items.values());
  }

  removeLinksByTerm(term: Term): void {
    const toRemove: string[] = [];
    for (const [id, entry] of this.items) {
      if (termsEqual(entry.sourceTerm, term) || termsEqual(entry.targetTerm, term)) {
        toRemove.push(id);
      }
    }
    for (const id of toRemove) {
      this.remove(id);
    }
  }

  private selectVictimId(): string | undefined {
    if (this.items.size === 0) return undefined;

    if (this.forgetPolicy === 'random') {
      const entries = Array.from(this.items.values());
      const randomId = entries[Math.floor(Math.random() * entries.length)]?.id;
      return randomId ?? undefined;
    }

    let lowestId: string | undefined;
    let lowestPriority = Number.POSITIVE_INFINITY;
    let oldestAccess = Number.POSITIVE_INFINITY;

    for (const [id, entry] of this.items) {
      if (this.forgetPolicy === 'lru' || this.forgetPolicy === 'fifo') {
        const accessTime = this.accessTimes.get(id) ?? entry.lastAccessedAt;
        if (accessTime < oldestAccess) {
          oldestAccess = accessTime;
          lowestId = id;
        }
      } else {
        if (
          entry.priority < lowestPriority ||
          (entry.priority === lowestPriority && entry.createdAt < oldestAccess)
        ) {
          lowestPriority = entry.priority;
          oldestAccess = entry.createdAt;
          lowestId = id;
        }
      }
    }

    return lowestId;
  }
}
