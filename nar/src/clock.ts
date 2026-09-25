/**
 * Phase A (REFACTOR.todo3): injectable clock (C8 — flakes are bugs).
 * Production uses `SystemClock` (zero-cost `Date.now()`); tests pin time with
 * `fixedClock` to eliminate millisecond-boundary nondeterminism.
 */
export interface Clock {
  now(): number;
}

export const SystemClock: Clock = { now: () => Date.now() };

export const fixedClock = (at: number): Clock => ({ now: () => at });
