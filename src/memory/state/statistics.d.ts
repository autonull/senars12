import type { Concept } from '../concept';
import type { StoreBounds, StorePressure } from '../ports/index';
export interface ConceptStats {
    totalConcepts: number;
    totalTasks: number;
    lowPriority: number;
    mediumPriority: number;
    highPriority: number;
}
/** Memory statistics for the MemoryView.stats() method. */
export interface MemoryStats {
    totalConcepts: number;
    totalTasks: number;
    focusedConcepts: number;
    archivedConcepts: number;
    indexStats?: {
        atomic: number;
        temporal: number;
    };
    archiveStats?: {
        size: number;
        capacity: number;
        utilization: number;
    };
    memoryPressure: number;
    utilization: number;
    pressureByBound: {
        concepts: number;
        tasks: number;
    };
    conceptDistribution: {
        lowPriority: number;
        mediumPriority: number;
        highPriority: number;
    };
}
/**
 * Occupancy per bound, and the pressure as their maximum.
 *
 * This arithmetic was written out twice in `memory.ts` — once in
 * `pressureBreakdown`, once inside `getStatistics` — so the health report, the
 * eviction policy and the statistics block could each be reading a different
 * number for the same store. `capacityPressure`, `getStatistics` and
 * `computeHealth` are the three readers that must agree, so they agree here.
 *
 * `max` rather than a weighted sum, because a weighted sum makes the reading move
 * when one bound is raised and the other is not, so "is the store under pressure"
 * would depend on how the two capacities were chosen (TODO29.a §5.8). A concept
 * count is the wrong denominator on its own too: a thousand concepts holding one
 * belief each and a thousand holding fifty each read identically.
 */
export declare const storePressure: (totals: Pick<ConceptStats, 'totalConcepts' | 'totalTasks'>, bounds: StoreBounds) => StorePressure;
/**
 * Totals only. The tercile split below costs a sort, so a caller that discards
 * the distribution — persistence does — pays for a sort it never reads unless it
 * asks for totals on their own.
 */
export declare const tallyConcepts: (concepts: Iterable<Concept>) => {
    totalConcepts: number;
    totalTasks: number;
};
/**
 * Totals and the priority distribution from one sweep. Both come out of a single
 * walk, which is what lets `getStatistics` read the counts {@link storePressure}
 * needs rather than sweeping the store again to re-derive them.
 */
export declare const calculateConceptStats: (concepts: Iterable<Concept>) => ConceptStats;
//# sourceMappingURL=statistics.d.ts.map