import { termKey, type Term } from '../../terms';
import type { RandomSource } from '../../types/primitives.js';
import { LinkBag } from './LinkBag.js';
import type { LinkEntry, LinkForgetPolicy, LinkInput, LinkQuery, LinkType } from './types.js';

const DEFAULT_TYPE: LinkType = 'term-link';
const DEFAULT_PRIORITY = 0.5;

/** Canonical link identity — the same `termKey` scheme used for concepts and bags. */
export const linkId = (source: Term, target: Term, type: LinkType = DEFAULT_TYPE): string =>
  `${termKey(source)}_${termKey(target)}_${type}`;

function addToIndex<K>(index: Map<K, Set<string>>, key: K, id: string): void {
  const bucket = index.get(key);
  if (bucket) bucket.add(id);
  else index.set(key, new Set([id]));
}

function removeFromIndex<K>(index: Map<K, Set<string>>, key: K, id: string): void {
  const bucket = index.get(key);
  if (!bucket) return;
  bucket.delete(id);
  if (bucket.size === 0) index.delete(key);
}

/**
 * A bounded, term-keyed link store.
 *
 * `LinkBag` owns capacity and the forget policy; this class owns identity and
 * the secondary indexes, and is the only place that mutates them. Bag eviction
 * (capacity pressure, decay) is routed back through `purge`, so the indexes can
 * never outlive the bag — the AIKR bound is the bound of every view.
 */
export class Layer {
  private readonly links = new Map<string, LinkEntry>();
  private readonly byType = new Map<LinkType, Set<string>>();
  private readonly byTerm = new Map<string, Set<string>>();
  private readonly bag: LinkBag;
  /** Re-entrancy guard: `purge` is reached from inside `LinkBag.remove`. */
  private purging?: string;

  constructor(
    readonly name: string,
    readonly capacity: number,
    forgetPolicy: LinkForgetPolicy = 'priority',
    rng?: RandomSource
  ) {
    this.bag = new LinkBag(capacity, forgetPolicy, (entry) => this.purge(entry), rng);
  }

  addLink(input: LinkInput): LinkEntry | null {
    const { sourceTerm, targetTerm, type = DEFAULT_TYPE, priority = DEFAULT_PRIORITY } = input;
    const id = linkId(sourceTerm, targetTerm, type);
    const existing = this.links.get(id);

    if (existing) {
      existing.priority = priority;
      existing.lastAccessedAt = Date.now();
      if (input.data) existing.data = input.data;
      this.bag.get(id);
      return existing;
    }

    const now = Date.now();
    const entry: LinkEntry = {
      id,
      sourceTerm,
      targetTerm,
      type,
      priority,
      createdAt: now,
      lastAccessedAt: now,
      ...(input.data ? { data: input.data } : {}),
    };

    if (!this.bag.add(entry)) return null;

    this.links.set(id, entry);
    addToIndex(this.byType, type, id);
    const sourceKey = termKey(sourceTerm);
    const targetKey = termKey(targetTerm);
    addToIndex(this.byTerm, sourceKey, id);
    if (targetKey !== sourceKey) addToIndex(this.byTerm, targetKey, id);

    return entry;
  }

  removeLink(source: Term, target: Term, type: LinkType = DEFAULT_TYPE): boolean {
    const id = linkId(source, target, type);
    const entry = this.links.get(id);
    return entry ? this.purge(entry) : false;
  }

  getLinkPriority(source: Term, target: Term, type: LinkType = DEFAULT_TYPE): number {
    return this.links.get(linkId(source, target, type))?.priority ?? 0;
  }

  getLinksByTerm(term: Term, query: LinkQuery = {}): LinkEntry[] {
    const ids = this.byTerm.get(termKey(term));
    return ids ? this.collect(ids, query) : [];
  }

  removeAllLinksForTerm(term: Term): void {
    const ids = this.byTerm.get(termKey(term));
    if (!ids) return;
    for (const id of [...ids]) {
      const entry = this.links.get(id);
      if (entry) this.purge(entry);
    }
  }

  applyDecay(decayRate: number): void {
    this.bag.applyDecay(decayRate);
  }

  getStats(): { size: number; capacity: number; utilization: number } {
    return {
      size: this.links.size,
      capacity: this.capacity,
      utilization: this.links.size / this.capacity,
    };
  }

  private collect(ids: Iterable<string>, query: LinkQuery): LinkEntry[] {
    const { type, minPriority = 0, maxResults = Number.POSITIVE_INFINITY } = query;
    const results: LinkEntry[] = [];

    for (const id of ids) {
      const entry = this.links.get(id);
      if (!entry || (type && entry.type !== type) || entry.priority < minPriority) continue;
      this.bag.get(id);
      results.push(entry);
      if (results.length >= maxResults) break;
    }

    return results;
  }

  /** Drop a link from the bag and every index, once. */
  private purge(entry: LinkEntry): boolean {
    if (this.purging === entry.id) return false;
    this.purging = entry.id;
    try {
      this.links.delete(entry.id);
      removeFromIndex(this.byType, entry.type, entry.id);
      removeFromIndex(this.byTerm, termKey(entry.sourceTerm), entry.id);
      removeFromIndex(this.byTerm, termKey(entry.targetTerm), entry.id);
      return this.bag.remove(entry.id);
    } finally {
      this.purging = undefined;
    }
  }
}
