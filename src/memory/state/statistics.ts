import { occupancy, percentiles } from '@senars/util';
import type { Concept } from '../concept.js';
import type { StoreBounds, StorePressure } from '../ports/index.js';

export interface ConceptStats {
  totalConcepts: number;
  totalTasks: number;
  lowPriority: number;
  mediumPriority: number;
  highPriority: number;
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
export const storePressure = (
  totals: Pick<ConceptStats, 'totalConcepts' | 'totalTasks'>,
  bounds: StoreBounds
): StorePressure => {
  const concepts = occupancy(totals.totalConcepts, bounds.maxConcepts);
  const tasks = occupancy(totals.totalTasks, bounds.maxTasks);
  return { concepts, tasks, capacity: Math.max(concepts, tasks) };
};

/**
 * Totals only. The tercile split below costs a sort, so a caller that discards
 * the distribution — persistence does — pays for a sort it never reads unless it
 * asks for totals on their own.
 */
export const tallyConcepts = (
  concepts: Iterable<Concept>
): { totalConcepts: number; totalTasks: number } => {
  let totalConcepts = 0;
  let totalTasks = 0;
  for (const concept of concepts) {
    totalConcepts++;
    totalTasks += concept.totalTasks;
  }
  return { totalConcepts, totalTasks };
};

/**
 * Totals and the priority distribution from one sweep. Both come out of a single
 * walk, which is what lets `getStatistics` read the counts {@link storePressure}
 * needs rather than sweeping the store again to re-derive them.
 */
export const calculateConceptStats = (concepts: Iterable<Concept>): ConceptStats => {
  const priorities: number[] = [];
  let totalTasks = 0;
  for (const concept of concepts) {
    totalTasks += concept.totalTasks;
    priorities.push(concept.priority);
  }
  const [p33 = 0, p67 = 0] = percentiles(priorities, [0.33, 0.67]);

  // One pass over the sample. The terciles are inclusive-low / exclusive-high,
  // so every concept lands in exactly one band and the third count is implied —
  // no per-band filter, no second materialization of the array.
  let lowPriority = 0;
  let mediumPriority = 0;
  for (const p of priorities) {
    if (p < p33) lowPriority++;
    else if (p < p67) mediumPriority++;
  }
  return {
    totalConcepts: priorities.length,
    totalTasks,
    lowPriority,
    mediumPriority,
    highPriority: priorities.length - lowPriority - mediumPriority,
  };
};
