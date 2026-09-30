import type { EvictionOrder } from '@senars/util';
import { addToSet, BoundedMap, occupancy } from '@senars/util';
import { type Term, termKey } from '../../terms';
import type { RandomSource } from '../../types/primitives.js';
import type { LinkEntry, LinkForgetPolicy, LinkInput, LinkQuery, LinkType } from './types.js';

const DEFAULT_TYPE: LinkType = 'term-link';
const DEFAULT_PRIORITY = 0.5;
/** Below this a decayed link is noise rather than a weak association. */
const DECAY_FLOOR = 0.01;

/** Canonical link identity — the same `termKey` scheme used for concepts and bags. */
export const linkId = (source: Term, target: Term, type: LinkType = DEFAULT_TYPE): string =>
  `${termKey(source)}_${termKey(target)}_${type}`;

/**
 * Forget policy → eviction order. `priority` evicts the weakest link, breaking
 * ties by creation order; `lru`/`fifo` differ only in whether a read refreshes
 * recency; `random` spreads eviction across the layer.
 */
const evictionOrder = (policy: LinkForgetPolicy): EvictionOrder<LinkEntry> =>
  policy === 'priority'
    ? { by: (entry) => entry.priority }
    : policy === 'fifo'
      ? 'fifo'
      : policy === 'random'
        ? 'random'
        : 'lru';

function removeFromIndex<K>(index: Map<K, Set<string>>, key: K, id: string): void {
  const bucket = index.get(key);
  if (!bucket) return;
  bucket.delete(id);
  if (bucket.size === 0) index.delete(key);
}

/**
 * A bounded, term-keyed link store.
 *
 * One {@link BoundedMap} holds the links *and* owns capacity and the forget
 * policy; this class owns identity and the secondary indexes. Eviction is
 * routed back through the map's `onEvict` hook, so a link can never outlive its
 * index entries and the AIKR bound is the bound of every view.
 */
export class Layer {
  private readonly links: BoundedMap<string, LinkEntry>;
  private readonly byType = new Map<LinkType, Set<string>>();
  private readonly byTerm = new Map<string, Set<string>>();

  constructor(
    readonly name: string,
    readonly capacity: number,
    forgetPolicy: LinkForgetPolicy = 'priority',
    rng?: RandomSource
  ) {
    this.links = new BoundedMap({
      maxSize: capacity,
      eviction: evictionOrder(forgetPolicy),
      onEvict: (entry) => this.forget(entry),
      rng,
    });
  }

  addLink(input: LinkInput): LinkEntry | null {
    const { sourceTerm, targetTerm, type = DEFAULT_TYPE, priority = DEFAULT_PRIORITY } = input;
    if (this.capacity < 1) return null;
    const id = linkId(sourceTerm, targetTerm, type);
    const existing = this.links.get(id);

    if (existing) {
      existing.priority = priority;
      existing.lastAccessedAt = Date.now();
      if (input.data) existing.data = input.data;
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

    this.links.set(id, entry);
    addToSet(this.byType, type, id);
    const sourceKey = termKey(sourceTerm);
    const targetKey = termKey(targetTerm);
    addToSet(this.byTerm, sourceKey, id);
    if (targetKey !== sourceKey) addToSet(this.byTerm, targetKey, id);

    return entry;
  }

  removeLink(source: Term, target: Term, type: LinkType = DEFAULT_TYPE): boolean {
    const entry = this.links.peek(linkId(source, target, type));
    return entry ? this.purge(entry) : false;
  }

  getLinkPriority(source: Term, target: Term, type: LinkType = DEFAULT_TYPE): number {
    return this.links.peek(linkId(source, target, type))?.priority ?? 0;
  }

  getLinksByTerm(term: Term, query: LinkQuery = {}): LinkEntry[] {
    const ids = this.byTerm.get(termKey(term));
    return ids ? this.collect(ids, query) : [];
  }

  removeAllLinksForTerm(term: Term): void {
    const ids = this.byTerm.get(termKey(term));
    if (!ids) return;
    for (const id of [...ids]) {
      const entry = this.links.peek(id);
      if (entry) this.purge(entry);
    }
  }

  applyDecay(decayRate: number): void {
    const doomed: string[] = [];
    for (const [id, entry] of this.links.entries()) {
      entry.priority = Math.max(0, entry.priority * (1 - decayRate));
      if (entry.priority < DECAY_FLOOR) doomed.push(id);
    }
    for (const id of doomed) {
      const entry = this.links.peek(id);
      if (entry) this.purge(entry);
    }
  }

  getStats(): { size: number; capacity: number; utilization: number } {
    return {
      size: this.links.size,
      capacity: this.capacity,
      utilization: occupancy(this.links.size, this.capacity),
    };
  }

  /** Occupancy in `0..1` — the AIKR pressure signal; a zero-capacity layer is under full pressure. */
  pressure(): number {
    return occupancy(this.links.size, this.capacity);
  }

  private collect(ids: Iterable<string>, query: LinkQuery): LinkEntry[] {
    const { type, minPriority = 0, maxResults = Number.POSITIVE_INFINITY } = query;
    const results: LinkEntry[] = [];

    for (const id of ids) {
      const entry = this.links.get(id);
      if (!entry || (type && entry.type !== type) || entry.priority < minPriority) continue;
      entry.lastAccessedAt = Date.now();
      results.push(entry);
      if (results.length >= maxResults) break;
    }

    return results;
  }

  /** Drop every index reference to a link. */
  private forget(entry: LinkEntry): void {
    removeFromIndex(this.byType, entry.type, entry.id);
    removeFromIndex(this.byTerm, termKey(entry.sourceTerm), entry.id);
    removeFromIndex(this.byTerm, termKey(entry.targetTerm), entry.id);
  }

  /** Drop a link from the map and every index, once. */
  private purge(entry: LinkEntry): boolean {
    this.forget(entry);
    return this.links.delete(entry.id);
  }
}
