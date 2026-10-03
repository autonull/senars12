/**
 * The injectable time source, shared by every subsystem that reads "now".
 *
 * A bare function rather than an object, so a clock and a `RandomSource` are the
 * *same shape*. Bounded containers, caches, rate limiters, deadlines and event
 * stamps all take one as `now`/`clock`, and a caller threading either through
 * those APIs has nothing to adapt — which is why the alternative spelling
 * (`{ now(): number }`) had to be converted at every boundary it crossed.
 */

/** Injectable wall-clock time in epoch milliseconds. */
export type Clock = () => number;

/**
 * The production default. A zero-cost `Date.now` wrapper rather than a reference
 * to it: the bare reference breaks the moment a `Clock` is also expected to be a
 * `RandomSource`, and `Date.now` needs its receiver.
 */
export const systemClock: Clock = () => Date.now();

/**
 * Frozen at `at` — the deterministic-test clock. Refusing to advance is the
 * point: a subsystem that stamps time twice under a pinned clock must emit the
 * same stamp twice, so a boundary flake becomes a failing assertion rather than
 * a pass that only happens to be ordered correctly.
 */
export const fixedClock =
  (at: number): Clock =>
  () =>
    at;
