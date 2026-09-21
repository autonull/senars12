import { v4 as uuidv4 } from 'uuid';
import { termParser } from '../terms/index.js';
import type { Focus, FocusTask } from './Focus.js';

export interface SeededBelief {
  /** Narsese, e.g. `(up ==> wall_bump)`. The antecedent atom names the action. */
  narsese: string;
  truth: { f: number; c: number };
  priority?: number;
}

/** Inject a Narsese rule belief into the focus's task bag (E7 Self-Concept-Vocabulary pattern). */
export function seedBelief(focus: Focus, belief: SeededBelief): FocusTask | null {
  const term = termParser.parse(belief.narsese);
  if (!term || term.kind === 'atom') return null;
  const priority = belief.priority ?? belief.truth.c;
  const task: FocusTask = {
    id: `seeded-${uuidv4()}`,
    priority,
    term,
    type: 'belief',
    truth: belief.truth,
    budget: { priority, durability: 0.9, quality: 0.9, cycles: 0, depth: 0 },
    stamp: 'belief-seeding',
    derived: false,
  };
  focus.tasks.add(task);
  return task;
}

/** Seed a per-action rule of the form `(<action> ==> <consequence>)`. */
export const actionRuleBelief = (
  action: string,
  consequence: string,
  truth: { f: number; c: number },
  priority?: number
): SeededBelief => ({ narsese: `(${action} ==> ${consequence})`, truth, priority });
