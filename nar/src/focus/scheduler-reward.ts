import { clamp } from '@senars/util';
import type { FocusStepReport } from './Focus.js';

/**
 * Focus-step reward for the `self-scheduler` learning domain: derivation rate
 * per processed task, rescaled from [0, ∞) onto [-1, 1]. The single formula
 * behind every scheduler adapter (focus tree, scheduler loop, self-meta game).
 */
export const schedulerReward = (report: FocusStepReport): number =>
  report.tasksProcessed <= 0 ? 0 : clamp((report.derivations / report.tasksProcessed - 0.5) * 2, -1, 1);
