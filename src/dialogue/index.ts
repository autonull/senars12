export { inferReactionFromUtterance } from './impls/attribution.js';
export type {
  AdaptationOptions,
  AdaptationRecord,
  StrategyController,
} from './impls/consumers/adapt.js';
export { RetrospectiveAdapter } from './impls/consumers/adapt.js';
export type {
  CurriculumSource,
  Probe,
  ProbeKind,
  ProbeSelection,
} from './impls/consumers/curriculum.js';
export { selectProbes } from './impls/consumers/curriculum.js';
export type {
  LessonSeed,
  ReconsolidationSink,
  RetrospectiveSource,
} from './impls/consumers/reconsolidate.js';
export { Reconsolidator } from './impls/consumers/reconsolidate.js';
export type { DialogueCaptureDeps, ExchangeInput } from './impls/DialogueCapture.js';
export { DialogueCapture, sha256 } from './impls/DialogueCapture.js';
export type { DialogueTextLedgerEntry, DialogueTextRecord } from './impls/DialogueTextStore.js';
export { DialogueTextStore } from './impls/DialogueTextStore.js';
export type { SessionReaction, SessionTurn } from './impls/retrospect.js';
export {
  digestPin,
  extractLessons,
  loadRetrospectives,
  persistRetrospective,
  retrospect,
} from './impls/retrospect.js';
export type {
  CausalChainEdge,
  CorrectionAnalysis,
  DialogueTurn,
  Lesson,
  Reaction,
  ReactionKind,
  Retrospective,
  StrategyAuditEntry,
} from './types.js';
export { emptyReactionDistribution, REACTION_KINDS } from './types.js';
