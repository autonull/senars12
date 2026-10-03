/**
 * The live cycle's stage vocabulary.
 *
 * The array is the single source of truth and the type is derived from it, so a
 * stage that is timed but not declared — or declared but never run — is a
 * compile error rather than a silent divergence. `CycleTrace` records which of
 * these regions was open when; `nar-execution.ts` opens them.
 */

/** Every stage a cycle may run, in the order a cycle runs them. */
export const CYCLE_STAGES = [
  'authorize',
  'perceive',
  'attend',
  'reason',
  'propose',
  'learn',
] as const;

export type CycleStage = (typeof CYCLE_STAGES)[number];