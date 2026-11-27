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
export {};
