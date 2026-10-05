/**
 * Memory statistics, indexing, links, and clock ports — the analytical and
 * cross-cutting surfaces over the concept store, and the only ones that name
 * nothing but memory's own types. `AttentionOwner` sits next door in
 * `attention-ports.ts` because it is the one contract here that names the
 * strategy layer.
 */

import type { Term } from '../../terms/index.js';
import type { Concept } from '../concept.js';
import type { Layer } from '../links/Layer.js';
import type { LinkEntry, LinkType } from '../links/types.js';
import type { RandomSource } from '../../types/primitives.js';
import type { Focus } from '../focus.js';
import type { AssociativeRegistry } from '../associative.js';

/** The two bounds a store's occupancy is measured against. */
export interface StoreBounds {
  maxConcepts: number;
  maxTasks: number;
}

export interface StorePressure {
  /** Occupancy of the concept count. */
  concepts: number;
  /** Occupancy of the task count. */
  tasks: number;
  /** The reported pressure: the maximum of the two bounds. */
  capacity: number;
}

export interface MemoryStatistics {
  totalConcepts: number;
  totalTasks: number;
  focusedConcepts: number;
  archivedConcepts: number;
  indexStats?: { atomic: number; temporal: number };
  archiveStats?: { size: number; capacity: number; utilization: number };
  memoryPressure: number;
  utilization: number;
  /** Which bound `memoryPressure` came from. Both are 0..1. */
  pressureByBound: { concepts: number; tasks: number };
  conceptDistribution: { lowPriority: number; mediumPriority: number; highPriority: number };
}

export interface StatisticsView {
  /** Store occupancy in `0..1` — the AIKR pressure signal. */
  capacityPressure(): number;
  /**
   * The bounds behind {@link capacityPressure}, so a report can name which one
   * is binding rather than reporting one number with two causes (TODO29.a §5.8).
   */
  pressureBreakdown(): StorePressure;
  /** Totals without the tercile pass; what persistence serializes. */
  totals(): { totalConcepts: number; totalTasks: number };
  getStatistics(): MemoryStatistics;
}

export interface SymbolIndex {
  queryBySymbol(symbol: string): Concept[];
  queryByTimeRange(start: number, end: number): Concept[];
  /** Concepts matching a substring of the printed term. */
  findConcepts(pattern: string, limit?: number): Concept[];
  /** Concepts sharing structure with `term`. */
  findSimilarConcepts(term: Term, limit?: number): Concept[];
  /** Link- or similarity-reachable concepts; never empty while `term` is known. */
  getRelatedConcepts(term: Term, limit?: number): Concept[];
}

export interface LinkPort {
  getLinks(
    sourceTerm: Term,
    options?: { layer?: string; type?: LinkType; minPriority?: number; maxResults?: number }
  ): LinkEntry[];
  getLinkPriority(sourceTerm: Term, targetTerm: Term, layerName?: string): number;
  addLink(
    sourceTerm: Term,
    targetTerm: Term,
    options?: { layer?: string; type?: LinkType; priority?: number }
  ): LinkEntry | null;
  removeByTerm(sourceTerm: Term, targetTerm: Term, type?: LinkType): boolean;
  removeAllLinksForTerm(term: Term): void;
  getLayer(name: string): Layer | undefined;
  setLayer(name: string, layer: Layer): void;
  applyDecay(decayRate?: number): void;
}

/** The consolidation tick. Its own port because it is the only place the decay
 *  clock advances (TODO29.a §4 row 1), and A4 replaces its body with the
 *  attention owner's `commit(now)` without touching a caller.
 */
export interface MemoryClock {
  consolidate(opts?: { cycleCount?: number }): void;
}
