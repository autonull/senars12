/**
 * Focus-level admission: the single place where game perceptions, reflex proposals,
 * and outcomes become kernel-visible FocusTasks.
 */

import type { FocusTask } from '../focus/Focus.js';
import type { Term } from '../terms';
import { operationTerm, TermBuilder, toAtomSymbol } from '../terms';
import { createTaskWeight } from '../types/core.js';

interface TaskSpec {
  id: string;
  term: Term;
  type: FocusTask['type'];
  priority: number;
  /** Budget priority; defaults to `priority` when a task's budget diverges from its bag priority. */
  budgetPriority?: number;
  f: number;
  c: number;
  stamp: string;
}

export const focusTask = ({
  id,
  term,
  type,
  priority,
  budgetPriority = priority,
  f,
  c,
  stamp,
}: TaskSpec): FocusTask => ({
  id,
  term,
  type,
  priority,
  truth: { f, c },
  budget: createTaskWeight(budgetPriority),
  stamp,
  derived: false,
});

/** `snake` — the game state as a plain belief. */
export const stateTerm = (stateId: string): Term => TermBuilder.atom(toAtomSymbol(stateId));

/** `[score_3]` — a named feature observed at a value. */
export const featureTerm = (feature: string, value: number): Term =>
  TermBuilder.setInt(TermBuilder.atom(toAtomSymbol(`${feature}_${String(value)}`)));

/** `[reward_positive]` — the sign of an outcome. */
export const rewardTerm = (reward: number): Term =>
  TermBuilder.setInt(TermBuilder.atom(reward >= 0 ? 'reward_positive' : 'reward_negative'));

/** `move(left --> right)` — a reflex proposal as an executable operation term. */
export const actionTerm = (action: string, args: Readonly<Record<string, unknown>>): Term =>
  operationTerm(action, args);
