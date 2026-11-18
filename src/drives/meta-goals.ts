/**
 * CORE.19 C5.6 — the drive→meta-goal injection policy, extracted and **off by
 * default**.
 *
 * A drive below its threshold names a self-operation goal — `switch_strategy(…)`,
 * `run_scenario_shadow(…)` — that the tool layer could execute. The table and the
 * pure policy that reads it live here so the mechanism can be revived or replaced
 * wholesale, but the cycle no longer binds them. A NAR that never sets
 * `NARConfig.driveMetaGoals` runs exactly as it did when the inline version was
 * inert: every mapped drive's leaky-integration equilibrium sat above its
 * threshold (~0.58–0.69 vs `0.3`), so nothing was ever injected. Binding a policy
 * is the opt-in, and the policy is pure, so a test drives it without a kernel.
 */

import { indexBy } from '@senars/util';
import { type Term, termParser } from '../terms';
import type { DriveState } from './types.js';

/** Drive → self-operation goal for homeostatic injection. */
const DRIVE_META_GOALS: Record<string, { threshold: number; narsese: string }> = {
  competence: {
    threshold: 0.3,
    narsese: 'switch_strategy((focused-->strategy),(derivation-->strategyType))',
  },
  curiosity: { threshold: 0.3, narsese: 'run_scenario_shadow((induction-->profile))' },
};

/** One parsed entry: the drive it answers, the intensity it answers below, the goal. */
export interface DriveMetaGoal {
  driveId: string;
  threshold: number;
  term: Term;
}

/**
 * The table's parsed form. A literal here is a constant, so it is either right or
 * a build break: a filter that matches nothing and a filter that was removed look
 * identical from the outside, and dropping a malformed literal silently is how
 * this path went inert unnoticed in the first place.
 */
export const DRIVE_META_GOAL_TABLE: readonly DriveMetaGoal[] = Object.entries(
  DRIVE_META_GOALS
).map(([driveId, goal]) => ({
  driveId,
  threshold: goal.threshold,
  term: termParser.parse(goal.narsese),
}));

/** Everything a policy needs to decide: the drives' state and a structural membership test. */
export interface MetaGoalContext {
  drives: readonly DriveState[];
  /** Terms already active or pending — a structurally-equal goal is not re-injected. */
  active: { has(term: Term): boolean };
}

/**
 * The injection policy. Absent on the config ⇒ the path is off, which is the
 * default; a bound policy is consulted once per `attend` stage.
 */
export interface MetaGoalPolicy {
  /** The goal terms to inject this cycle — one per deficient, not-already-active drive. */
  plan(ctx: MetaGoalContext): Term[];
}

/** Bind a policy over a table (default: the built-in drive→meta-goal table). */
export const createDriveMetaGoalPolicy = (
  table: readonly DriveMetaGoal[] = DRIVE_META_GOAL_TABLE
): MetaGoalPolicy => {
  const byId = indexBy(table, (goal) => goal.driveId);
  return {
    plan: ({ drives, active }) => {
      const goals: Term[] = [];
      for (const state of drives) {
        const goal = byId.get(state.spec.id);
        if (goal && state.currentIntensity < goal.threshold && !active.has(goal.term))
          goals.push(goal.term);
      }
      return goals;
    },
  };
};
