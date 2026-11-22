/**
 * The memory ports — one module per responsibility, and per dependency direction:
 * - concept-ports: ConceptReader, ConceptWriter (concept-level storage)
 * - task-ports: TaskAdmission, BeliefTable, GoalEnumeration (per-concept task bags + goals)
 * - memory-ports: StatisticsView, SymbolIndex, LinkPort, MemoryClock (analytics) — names
 *   nothing but memory's own types, so the read surface can depend on it directly
 * - attention-ports: AttentionOwner — the one port that names `strategies/`, which is
 *   why it is alone in a module
 *
 * Every contract here is **structural**: nothing mentions the `Memory` facade or
 * any other implementation, so a store, a table or a statistics view can be
 * swapped without touching a caller. These modules import only memory's own
 * types plus the strategy contracts they constrain — never the reverse edge —
 * which is what keeps `strategies/ → memory/` one-way and acyclic.
 */

export type {
  ConceptReader,
  ConceptWriter,
} from './concept-ports';

export type {
  TaskAdmission,
  BeliefTable,
  GoalEnumeration,
} from './task-ports';

export type {
  StoreBounds,
  StorePressure,
  MemoryStatistics,
  StatisticsView,
  SymbolIndex,
  LinkPort,
  MemoryClock,
} from './memory-ports';

export type { AttentionOwner } from './attention-ports';

import type { ConceptReader, ConceptWriter } from './concept-ports';
import type { TaskAdmission, BeliefTable, GoalEnumeration } from './task-ports';
import type { AttentionOwner } from './attention-ports';
import type { StatisticsView, SymbolIndex, LinkPort, MemoryClock } from './memory-ports';
import type { ConceptGraph } from '../ConceptGraph';
import type { MemoryView } from '../view';

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

/** Everything the reasoning cycle is allowed to reach on memory. */
export interface MemoryPorts
  extends MemoryView,
    MemoryReader,
    MemoryWriter,
    MemoryClock,
    AttentionOwner {}