/**
 * The memory ports — one module per responsibility, so a consumer depends on the
 * one it needs and `Memory` stays the composition of them (TODO29.a §5.5).
 *
 * Every contract here is **structural**: nothing mentions the `Memory` facade or
 * any other implementation, so a store, a table or a statistics view can be
 * swapped without touching a caller. These modules import only memory's own
 * types plus the strategy contracts they constrain — never the reverse edge —
 * which is what keeps `strategies/ → memory/` one-way and acyclic.
 */

import type { ConceptGraph } from '../ConceptGraph.js';
import type { MemoryView } from '../view.js';
import type { AttentionOwner } from './attention-owner.js';

import type { ConceptReader, ConceptWriter } from './concept-store.js';
import type { GoalEnumeration } from './goal-enumeration.js';
import type { LinkPort } from './links.js';
import type { MemoryStatistics, StatisticsView, SymbolIndex } from './statistics-view.js';
import type { BeliefTable, TaskAdmission } from './task-table.js';

export type { AttentionOwner } from './attention-owner.js';
export type { ConceptReader, ConceptWriter } from './concept-store.js';
export type { GoalEnumeration } from './goal-enumeration.js';
export type { LinkPort } from './links.js';
export type { MemoryStatistics, StatisticsView, SymbolIndex } from './statistics-view.js';
export type { BeliefTable, TaskAdmission } from './task-table.js';

/**
 * What a consumer reads. One owner per quantity: concepts here, task admission
 * in {@link MemoryWriter}, the consolidation clock in {@link MemoryClock}.
 */
export interface MemoryReader
  extends ConceptReader,
    GoalEnumeration,
    StatisticsView,
    SymbolIndex,
    BeliefTable {
  links(): LinkPort;
  /** Publish the co-activation graph as the `graph` associative memory. */
  attachConceptGraph(graph: ConceptGraph): ConceptGraph;
}

export interface MemoryWriter extends ConceptWriter, TaskAdmission {}

/**
 * The consolidation tick. Its own port because it is the only place the decay
 * clock advances (TODO29.a §4 row 1), and A4 replaces its body with the
 * attention owner's `commit(now)` without touching a caller.
 */
export interface MemoryClock {
  consolidate(opts?: { cycleCount?: number }): void;
}

/** Everything the reasoning cycle is allowed to reach on memory. */
export interface MemoryPorts
  extends MemoryView,
    MemoryReader,
    MemoryWriter,
    MemoryClock,
    AttentionOwner {}