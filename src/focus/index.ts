/**
 * Focus — game focus and reflex types (migrated from @senars/nar/focus).
 */

export type { Game, GameOutcome, MetaGame, Perception, SelfMetaGame } from '@senars/nar/game';
export type { ActionProposal, LearningEvent, Reflex } from '@senars/nar/reflex';
export { actionRuleBelief, type SeededBelief, seedBelief } from '@senars/nar/focus/belief-seeding';
export { induceEpisodeSchemas, type PromotedSchema } from '@senars/nar/focus/episode-schemas';
export type { FocusConcept, FocusOptions, FocusStepReport, FocusTask } from '@senars/nar/focus/Focus';
export { Focus } from '@senars/nar/focus/Focus';
export {
  featureTerm,
  focusTask,
  outcomeTasks,
  perceptionTasks,
  proposalTasks,
  rewardTerm,
  stateTerm,
} from '@senars/nar/focus/task';
export { createFocus, FocusBag } from '@senars/nar/focus/FocusBag';
export {
  createFocusScheduler,
  FocusScheduler,
  type FocusSchedulerOptions,
  type SchedulerTickResult,
} from '@senars/nar/focus/focus-scheduler';
export {
  createFocusTree,
  FocusTree,
  type FocusTreeOptions,
  type FocusTreeRollup,
} from '@senars/nar/focus/FocusTree';
export type { TickPanelEntry } from '@senars/nar/focus/GameFocus';
export { createGameFocus, GameFocus } from '@senars/nar/focus/GameFocus';
export type { MetaFocusOptions } from '@senars/nar/focus/MetaFocus';
export { createMetaFocus, MetaFocus } from '@senars/nar/focus/MetaFocus';
export { type NalABResult, runNalAB } from '@senars/nar/focus/nal-ab';
export { SchemaStore, type StoredSchema } from '@senars/nar/focus/schema-store';