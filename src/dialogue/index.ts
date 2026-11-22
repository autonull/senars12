export { inferReactionFromUtterance } from './impls/attribution';
export type {
  AdaptationOptions,
  AdaptationRecord,
  StrategyController,
} from './impls/consumers/adapt';
export { RetrospectiveAdapter } from './impls/consumers/adapt';
export type {
  CurriculumSource,
  Probe,
  ProbeKind,
  ProbeSelection,
} from './impls/consumers/curriculum';
export { selectProbes } from './impls/consumers/curriculum';
export type {
  LessonSeed,
  ReconsolidationSink,
  RetrospectiveSource,
} from './impls/consumers/reconsolidate';
export { Reconsolidator } from './impls/consumers/reconsolidate';
export type { DialogueCaptureDeps, ExchangeInput } from './impls/DialogueCapture';
export { DialogueCapture, sha256 } from './impls/DialogueCapture';
export type { DialogueTextLedgerEntry, DialogueTextRecord } from './impls/DialogueTextStore';
export { DialogueTextStore } from './impls/DialogueTextStore';
export type { SessionReaction, SessionTurn } from './impls/retrospect';
export {
  digestPin,
  extractLessons,
  loadRetrospectives,
  persistRetrospective,
  retrospect,
} from './impls/retrospect';
export type {
  CausalChainEdge,
  CorrectionAnalysis,
  DialogueTurn,
  Lesson,
  Reaction,
  ReactionKind,
  Retrospective,
  StrategyAuditEntry,
} from './types';
export { emptyReactionDistribution, REACTION_KINDS } from './types';
