import { makeId } from '@senars/util';
import { focusTask } from '../gates/tasks.js';
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
  const task = focusTask({
    id: `seeded-${makeId()}`,
    term,
    type: 'belief',
    priority: belief.priority ?? belief.truth.c,
    f: belief.truth.f,
    c: belief.truth.c,
    stamp: 'belief-seeding',
  });
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
