/**
 * Task admission and belief/goal enumeration ports — the write surface for
 * per-concept task bags and the read surface for cross-concept goal queries.
 *
 * Split from concept ports because minting a task's stamp is a write decision
 * and reading the goal list is not (TODO29.a §4 row 5).
 */

import type { Stamp, Term, Truth } from '../../terms/index.js';
import type { Budget } from '../../types/index.js';
import type { Concept, ConceptTaskType, TaskData } from '../concept.js';
import type { Task } from '../../types/index.js';

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

export interface GoalEnumeration {
  getGoals(): Task[];
}