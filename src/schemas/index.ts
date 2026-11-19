/**
 * Operational invariants boundary — the zod schemas that define the trusted
 * kernel's validation layer at untrusted boundaries.
 *
 * One vocabulary per module, layered so that a module only depends on the ones
 * below it: `task` (the kind of claim and its sentence mark) and `truth` (the
 * epistemic pair and the source-quality ceiling) → `reasoning-budget` →
 * `governance` → `cognitive-events` → `gate-io`, with `derivation-records` and
 * `formalization` hanging off `truth` alone. A caller
 * that needs one contract imports that module rather than this barrel, and a
 * module that grows a field cannot silently widen a sibling's.
 */
export type {
  AutonomyModeChangedEvent,
  BeliefRevisedEvent,
  BudgetExhaustedEvent,
  CognitiveEvent,
  CognitiveEventOf,
  ConceptActivatedEvent,
  DerivationAcceptedEvent,
  EgressGateRejectedEvent,
  JudgmentResolvedEvent,
  PolicyViolationEvent,
  SelfModProposalEvent,
  ShadowValidationDropEvent,
  StimulusSource,
  TaskAdmittedEvent,
} from './cognitive-events.js';
export {
  AutonomyModeChangedEventSchema,
  BeliefRevisedEventSchema,
  BudgetExhaustedEventSchema,
  CognitiveEventSchema,
  ConceptActivatedEventSchema,
  DerivationAcceptedEventSchema,
  EgressGateRejectedEventSchema,
  isEventType,
  isNarEvent,
  JudgmentResolvedEventSchema,
  mintCognitiveEvent,
  PolicyViolationEventSchema,
  SelfModProposalEventSchema,
  ShadowValidationDropEventSchema,
  STIMULUS_SOURCES,
  StimulusSourceSchema,
  TaskAdmittedEventSchema,
  validateCognitiveEvent,
} from './cognitive-events.js';
export type {
  Budget,
  HistoryEntry,
  Independence,
  RulePattern,
  RulePatternSide,
} from './common.js';
export {
  BudgetSchema,
  HistoryEntrySchema,
  INDEPENDENCE,
  IndependenceSchema,
  RulePatternSchema,
  RulePatternSideSchema,
} from './common.js';
export type { DerivationRecord, DerivationStep, RuleCategory } from './derivation-records.js';
export {
  DerivationRecordSchema,
  DerivationStepSchema,
  RULE_CATEGORIES,
  RuleCategorySchema,
  validateDerivationRecord,
} from './derivation-records.js';
export { CognitiveEventBaseSchema, EngineOriginSchema, PROPOSER_ORIGIN } from './event-base.js';
export type {
  AmbiguityFlag,
  AmbiguityReport,
  AmbiguitySeverity,
  AmbiguityType,
  DetectedIntent,
  FormalizationBatch,
  FormalizationCandidate,
  SourceSpan,
} from './formalization.js';
export {
  AMBIGUITY_SEVERITIES,
  AMBIGUITY_SEVERITY,
  AMBIGUITY_TYPES,
  AmbiguityFlagSchema,
  AmbiguityReportSchema,
  ambiguitySeverityOf,
  DETECTED_INTENTS,
  DetectedIntentSchema,
  FormalizationBatchSchema,
  FormalizationCandidateSchema,
  SourceSpanSchema,
  validateFormalizationBatch,
  validateFormalizationCandidate,
} from './formalization.js';
/**
 * Gate I/O types and schemas are deliberately NOT re-exported from this barrel
 * to avoid a circular dependency with reasoning-budget. Import directly from
 * @senars/schemas/gate-io.js instead.
 */
export type {
  AutonomyAuthority,
  AutonomyMode,
  GameDomain,
  GovernanceDecision,
  GovernanceEvent,
  PatchProposal,
  RewardDomain,
  RiskAssessment,
  RiskLevel,
  SelfImprovementProposal,
} from './governance.js';
export {
  AUTONOMITY_AUTHORITIES,
  AutonomyAuthoritySchema,
  AutonomyModeSchema,
  GameDomainSchema,
  GovernanceDecisionSchema,
  GovernanceEventSchema,
  PatchProposalSchema,
  PROPOSAL_RISK,
  permitsExecution,
  proposalRisk,
  RewardDomainSchema,
  RISK_LEVELS,
  RiskAssessmentSchema,
  RiskLevelSchema,
  riskLevelOf,
  SelfImprovementProposalSchema,
} from './governance.js';
export { NarEventSchemas } from './nar-events.js';
export type { KernelControlState } from './nar-events.js';
export { KERNEL_CONTROL_STATES } from './nar-events.js';
export type {
  ContentProposal,
  Proposal,
  ProposalAdmittedEvent,
  ProposalRejectedEvent,
  ProposalRejection,
  RuleProposal,
} from './proposal.js';
export {
  ContentProposalSchema,
  PROPOSAL_KINDS,
  PROPOSAL_REJECTIONS,
  PROPOSAL_SCHEMA_VERSION,
  ProposalAdmittedEventSchema,
  ProposalRejectedEventSchema,
  ProposalSchema,
  RuleProposalSchema,
  validateProposal,
} from './proposal.js';
export type {
  BudgetScopeId,
  BudgetType,
  ConsumedBudget,
  ReasoningBudget,
  TerminationReason,
} from './reasoning-budget.js';
export {
  BUDGET_SCOPE_IDS,
  BUDGET_TYPES,
  BudgetTypeSchema,
  ConsumedBudgetSchema,
  ReasoningBudgetSchema,
  TerminationReasonSchema,
  validateReasoningBudget,
  zeroConsumed,
} from './reasoning-budget.js';
export type {
  RuleArtifactEntry,
  RuleDeclaration,
  RuleProvenance,
  RuleTable,
  RuleTableDiff,
  RuleTableFault,
  RuleTableRejection,
} from './rule-table.js';
export {
  BUILTIN_RULE_ARTIFACT_VERSION,
  RULE_TABLE_REJECTIONS,
  RULE_TABLE_SCHEMA_VERSION,
  RuleArtifactEntrySchema,
  RuleDeclarationSchema,
  RuleProvenanceSchema,
  RuleTableSchema,
  validateRuleTable,
} from './rule-table.js';
export type { TaskBagKind, TaskPunctuation, TaskType } from './task.js';
export {
  TASK_BAG_KINDS,
  TASK_PUNCTUATION,
  TASK_PUNCTUATIONS,
  TASK_TYPES,
  TaskBagKindSchema,
  TaskPunctuationSchema,
  TaskTypeSchema,
  TOLERANT_PUNCTUATIONS,
  taskTypeForPunctuation,
} from './task.js';
export type { CeilingLimits, CeilingReputation, SourceQuality, TruthValue } from './truth.js';
export {
  confidenceCeiling,
  SOURCE_QUALITY_CONFIDENCE,
  SourceQualitySchema,
  TruthValueSchema,
} from './truth.js';

/**
 * Which cognitive events the append-only log keeps, and which of those episodic
 * recall reads (CORE.19 C1.2).
 * Re-exported from recalled-events.ts to avoid circular dependency with the schemas barrel.
 */
export {
  DURABLE_EVENT_TYPES,
  RECALLED_EVENT_TYPES,
  isDurableEvent,
  recalledEventTypes,
} from './recalled-events.js';
