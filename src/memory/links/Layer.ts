import type { ContainerStats, EvictionOrder } from '@senars/util';
import {
  addToSet,
  BoundedMap,
  type Clock,
  collectUpTo,
  containerStats,
  occupancy,
  removeFromSet,
  retain,
  systemClock,
} from '@senars/util';
import { LINK } from '../../constants.js';
import { type Term, termKey } from '../../terms';
import type { RandomSource } from '../../types/primitives.js';
import type { LinkEntry, LinkForgetPolicy, LinkInput, LinkQuery, LinkType } from './types.js';

const DEFAULT_TYPE: LinkType = 'term-link';
const DEFAULT_PRIORITY = 0.5;

/** Canonical link identity — the same `termKey` scheme used for concepts and bags. */
export const linkId = (source: Term, target: Term, type: LinkType = DEFAULT_TYPE): string =>
  `${termKey(source)}_${termKey(target)}_${type}`;

/**
 * Forget policy → eviction order. `priority` evicts the weakest link, breaking
 * ties by creation order; `lru`/`fifo` differ only in whether a read refreshes
 * recency; `random` spreads eviction across the layer.
 */
const LINK_EVICTION_ORDER: Record<LinkForgetPolicy, EvictionOrder<LinkEntry>> = {
  priority: { by: (entry) => entry.priority },
  fifo: 'fifo',
  lru: 'lru',
  random: 'random',
};

const linkEvictionOrder = (policy: LinkForgetPolicy): EvictionOrder<LinkEntry> =>
  LINK_EVICTION_ORDER[policy];

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
  private readonly byTerm = new Map<string, Set<string>>();

  private readonly now: Clock;

  constructor(
    readonly name: string,
    readonly capacity: number,
    forgetPolicy: LinkForgetPolicy = 'priority',
    rng?: RandomSource,
    clock?: Clock
  ) {
    this.now = clock ?? systemClock;
    this.links = new BoundedMap({
      maxSize: capacity,
      eviction: linkEvictionOrder(forgetPolicy),
      onEvict: (entry) => this.forget(entry),
      rng,
      now: this.now,
    });
  }

  /** Stamp a link as read. Both recency writers went through the wall clock directly,
   *  so the layer's own LRU order was untestable while its map's order was pinned. */
  private touch(entry: LinkEntry): void {
    entry.lastAccessedAt = this.now();
  }

  addLink(input: LinkInput): LinkEntry | null {
    const { sourceTerm, targetTerm, type = DEFAULT_TYPE, priority = DEFAULT_PRIORITY } = input;
    if (this.capacity < 1) return null;
    const id = linkId(sourceTerm, targetTerm, type);
    const existing = this.links.get(id);

    if (existing) {
      existing.priority = priority;
      this.touch(existing);
      if (input.data) existing.data = input.data;
      return existing;
    }

    const now = this.now();
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

  /**
   * Drop every link this layer holds for `term`.
   *
   * The one removal seam a layer extends: `LinkManager` fans this out over all
   * layers, so a subclass that keeps state keyed by term — `EmbeddingLayer` and
   * its vectors — overrides this rather than being reached around. It used to
   * resolve the default layer only, so a term removed from the concept store
   * kept its semantic edges and its embedding alive, and only the embedding
   * layer's own bound could ever release them.
   */
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
      entry.priority = retain(entry.priority, decayRate);
      if (entry.priority < LINK.MIN_PRIORITY) doomed.push(id);
    }
    for (const id of doomed) {
      const entry = this.links.peek(id);
      if (entry) this.purge(entry);
    }
  }

  getStats(): ContainerStats {
    return containerStats(this.links.size(), this.capacity);
  }

  /** Occupancy in `0..1` — the AIKR pressure signal; a zero-capacity layer is under full pressure. */
  pressure(): number {
    return occupancy(this.links.size(), this.capacity);
  }

  private collect(ids: Iterable<string>, query: LinkQuery): LinkEntry[] {
    const { type, minPriority = 0, maxResults = Number.POSITIVE_INFINITY } = query;
    return collectUpTo(ids, maxResults, (id) => {
      const entry = this.links.get(id);
      if (!entry || (type && entry.type !== type) || entry.priority < minPriority) {
        return undefined;
      }
      this.touch(entry);
      return entry;
    });
  }

  /** Drop every index reference to a link. */
  private forget(entry: LinkEntry): void {
    removeFromSet(this.byTerm, termKey(entry.sourceTerm), entry.id);
    removeFromSet(this.byTerm, termKey(entry.targetTerm), entry.id);
  }

  /** Drop a link from the map and every index, once. */
  private purge(entry: LinkEntry): boolean {
    this.forget(entry);
    return this.links.delete(entry.id);
  }
}
