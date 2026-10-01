/**
 * The statistics view — a read port over what the store counts.
 *
 * `MemoryStatistics` lives here rather than in `memory.ts` so a consumer can
 * depend on the shape without depending on the facade that computes it
 * (TODO29.a §5.5).
 */

import type { Term } from '../../terms/index.js';
import type { Concept } from '../concept.js';

export interface MemoryStatistics {
  totalConcepts: number;
  totalTasks: number;
  focusedConcepts: number;
  archivedConcepts: number;
  indexStats?: { atomic: number; temporal: number; activation: number };
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
  pressureBreakdown(): { concepts: number; tasks: number; capacity: number };
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