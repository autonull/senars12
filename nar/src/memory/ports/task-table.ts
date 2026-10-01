/**
 * Per-concept task admission and belief reads — the write half of the store.
 *
 * Split from `ConceptReader` because recalling a concept and admitting a task
 * are different authorities: a consumer that only recalls must not hold the
 * surface that writes (TODO29.a §1.1's "one owner", narrowed to the task).
 */

import type { Stamp, Term, Truth } from '../../terms/index.js';
import type { Budget } from '../../types/index.js';
import type { Concept, ConceptTaskType, TaskData } from '../concept.js';

export interface TaskAdmission {
  /** Admit `term` into `type` on its concept, minting a stamp when none is given. */
  addTask(
    term: Term,
    type: ConceptTaskType,
    truth?: Truth,
    budget?: Budget,
    stamp?: Stamp
  ): boolean;
}

export interface BeliefTable {
  /** The concept's belief tasks, highest priority first. */
  beliefs(concept: Concept): TaskData[];
  /** Tasks across all three of the concept's bags. */
  taskCount(concept: Concept): number;
}