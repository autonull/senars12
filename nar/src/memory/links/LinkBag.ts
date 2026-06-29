import type { Term } from '../../terms';
import { termsEqual } from '../../terms';
import { BaseBag } from '../BaseBag.js';
import type { LinkEntry } from './types.js';

export class LinkBag extends BaseBag<LinkEntry> {
  private readonly items: Map<string, LinkEntry>;
  private priorityIndex: Map<string, number>;
  private accessTimes: Map<string, number>;
  private readonly onRemoved?: (entry: LinkEntry) => void;

  constructor(
    capacity: number,
    private readonly forgetPolicy: 'priority' | 'lru' | 'fifo' | 'random',
    onRemoved?: (entry: LinkEntry) => void
  ) {
    super({ capacity });
    this.items = new Map();
    this.priorityIndex = new Map();
    this.accessTimes = new Map();
    this.onRemoved = onRemoved;
  }

  override get size(): number {
    return this.items.size;
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
    this.trackAdd();
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
    this.trackRemoval();
    return true;
  }

  get(id: string): LinkEntry | undefined {
    const entry = this.items.get(id);
    if (entry) {
      entry.lastAccessedAt = Date.now();
      this.accessTimes.set(id, entry.lastAccessedAt);
      this.trackHit();
    } else {
      this.trackMiss();
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

  *entries(): IterableIterator<LinkEntry> {
    for (const entry of this.items.values()) {
      yield entry;
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

  protected override itemsCount(): number {
    return this.items.size;
  }

  protected override getPriorities(): number[] {
    return Array.from(this.priorityIndex.values());
  }

  protected override getAges(): number[] {
    return Array.from(this.accessTimes.values()).map((t) => Date.now() - t);
  }

  protected override getCreatedTimes(): number[] {
    return Array.from(this.items.values()).map((e) => e.createdAt);
  }

  protected override selectVictim(): string | undefined {
    return this.selectVictimId();
  }

  protected override removeById(id: string): boolean {
    return this.remove(id);
  }

  protected override updateAccess(id: string): void {
    const entry = this.items.get(id);
    if (entry) {
      entry.lastAccessedAt = Date.now();
      this.accessTimes.set(id, entry.lastAccessedAt);
    }
  }

  protected override getIds(): string[] {
    return Array.from(this.items.keys());
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
