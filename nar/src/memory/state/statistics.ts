import { percentile } from '@senars/util';
import type { Concept } from '../concept.js';

export interface ConceptStats {
  totalConcepts: number;
  totalTasks: number;
  lowPriority: number;
  mediumPriority: number;
  highPriority: number;
}

/**
 * Totals only. The tercile split below costs two percentile sorts, so a caller
 * that discards the distribution — persistence does — pays for a sort it never
 * reads unless it asks for totals on their own.
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

export const calculateConceptStats = (concepts: Iterable<Concept>): ConceptStats => {
  const priorities: number[] = [];
  let totalTasks = 0;
  for (const concept of concepts) {
    totalTasks += concept.totalTasks;
    priorities.push(concept.priority);
  }
  const p33 = percentile(priorities, 0.33);
  const p67 = percentile(priorities, 0.67);

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
