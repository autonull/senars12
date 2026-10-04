import { raceDeadline } from '@senars/util';

/**
 * Wall-clock budget for one focus step, when a driver names none. Both focus
 * drivers defaulted to it independently.
 */
export const DEFAULT_FOCUS_DEADLINE_MS = 50;

/**
 * Step one focus under a wall-clock deadline, and say whether the deadline won.
 *
 * The cooperative-yield primitive (AIKR interruptibility) the two focus drivers
 * share: the step keeps running when the deadline fires, so `yielded` is not a
 * failure — it is the caller giving the event loop back. Both the tree and the
 * flat loop spelled this out as their own `raceDeadline` plus a `yielded` flag,
 * and a step that legitimately produced nothing was indistinguishable from a
 * step the deadline cut off.
 */
export const stepFocusUnderDeadline = async <T>(
  work: Promise<T>,
  deadlineMs: number = DEFAULT_FOCUS_DEADLINE_MS
): Promise<{ report: T | null; yielded: boolean }> => {
  const { value } = await raceDeadline(work, deadlineMs);
  return value === undefined ? { report: null, yielded: true } : { report: value, yielded: false };
};