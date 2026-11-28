import type { ContainerStats } from '@senars/util/collections';
import { type Clock } from '@senars/util/clock';
import { type Term } from '../../terms';
import type { RandomSource } from '../../types/primitives';
import type { LinkEntry, LinkForgetPolicy, LinkInput, LinkQuery, LinkType } from './types';
/** Canonical link identity — the same `termKey` scheme used for concepts and bags. */
export declare const linkId: (source: Term, target: Term, type?: LinkType) => string;
/**
 * A bounded, term-keyed link store.
 *
 * One {@link BoundedMap} holds the links *and* owns capacity and the forget
 * policy; this class owns identity and the secondary indexes. Eviction is
 * routed back through the map's `onEvict` hook, so a link can never outlive its
 * index entries and the AIKR bound is the bound of every view.
 */
export declare class Layer {
    readonly name: string;
    readonly capacity: number;
    private readonly links;
    private readonly byTerm;
    private readonly now;
    constructor(name: string, capacity: number, forgetPolicy?: LinkForgetPolicy, rng?: RandomSource, clock?: Clock);
    /** Stamp a link as read. Both recency writers went through the wall clock directly,
     *  so the layer's own LRU order was untestable while its map's order was pinned. */
    private touch;
    addLink(input: LinkInput): LinkEntry | null;
    removeLink(source: Term, target: Term, type?: LinkType): boolean;
    getLinkPriority(source: Term, target: Term, type?: LinkType): number;
    getLinksByTerm(term: Term, query?: LinkQuery): LinkEntry[];
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
    removeAllLinksForTerm(term: Term): void;
    applyDecay(decayRate: number): void;
    getStats(): ContainerStats;
    /** Occupancy in `0..1` — the AIKR pressure signal; a zero-capacity layer is under full pressure. */
    pressure(): number;
    private collect;
    /** Drop every index reference to a link. */
    private forget;
    /** Drop a link from the map and every index, once. */
    private purge;
}
//# sourceMappingURL=Layer.d.ts.map