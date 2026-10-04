import { clampSigned, safeRatio } from '@senars/util';
import type { MetaGame } from '../game/impls/MetaGame.js';
import type { SchedulerAdapter } from '../learning/domain-learners.js';
import type { FocusStepReport } from './Focus.js';

/**
 * Focus-step reward for the `self-scheduler` learning domain: derivation rate
 * per processed task, rescaled from [0, ∞) onto [-1, 1]. The single formula
 * behind every scheduler adapter (focus tree, scheduler loop, self-meta game).
 */
export const schedulerReward = (report: FocusStepReport): number =>
  report.tasksProcessed <= 0
    ? 0
    : clampSigned((safeRatio(report.derivations, report.tasksProcessed) - 0.5) * 2);

/**
 * Publish one focus step to both of its learners.
 *
 * A focus step is one piece of evidence about scheduling, and it has exactly two
 * consumers: the meta-game's own record and the `self-scheduler` reward. Both are
 * fed here because both drivers — the tree and the flat loop — otherwise spelled
 * the pair out, and a driver that learned the reward without recording the step
 * would teach the scheduler from reports it cannot reconstruct.
 */
export const publishFocusStepReport = (
  metaGame: MetaGame | undefined,
  adapter: SchedulerAdapter | undefined,
  focusId: string,
  report: FocusStepReport
): void => {
  metaGame?.recordFocusStepReport(report);
  adapter?.learn({ domain: 'self-scheduler', reward: schedulerReward(report), focusId });
};
