/**
 * The live cycle's stage vocabulary.
 *
 * The array is the single source of truth and the type is derived from it, so a
 * stage that is timed but not declared — or declared but never run — is a
 * compile error rather than a silent divergence. `CycleTrace` records which of
 * these regions was open when; `nar-execution.ts` opens them.
 */

/**
 * Regions opened *inside* a cycle by a subsystem rather than by the cycle
 * itself — the optimiser, the self-monitor, consolidation. They share the trace's
 * record because a reader asks "where did the cycle go?" and these are part of
 * the answer, but they are not stages: a cycle does not run them in order.
 */
export const AUXILIARY_REGIONS = [
  'cycle',
  'rlfp.optimize',
  'self.assess',
  'self.correct',
  'memory.consolidate',
] as const;

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
export type AuxiliaryRegion = (typeof AUXILIARY_REGIONS)[number];

/** Anything the trace can time: a cycle stage, or a region opened inside one. */
export type TraceRegion = CycleStage | AuxiliaryRegion;
