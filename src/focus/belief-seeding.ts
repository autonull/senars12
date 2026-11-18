import { makeId, type TermTruth } from '@senars/util';
import { termParser } from '../terms/index.js';
import type { Focus, FocusTask } from './Focus.js';
import { focusTask } from './task.js';

export interface SeededBelief {
  /** Narsese, e.g. `(up ==> wall_bump)`. The antecedent atom names the action. */
  narsese: string;
  truth: TermTruth;
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
  truth: TermTruth,
  priority?: number
): SeededBelief => ({ narsese: `(${action} ==> ${consequence})`, truth, priority });
