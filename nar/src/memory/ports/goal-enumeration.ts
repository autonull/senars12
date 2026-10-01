/**
 * Goal enumeration — a port, because minting a task's stamp is a write decision
 * and reading the goal list is not (TODO29.a §4 row 5).
 */

import type { Task } from '../../types/index.js';

export interface GoalEnumeration {
  getGoals(): Task[];
}