/**
 * Operational invariants boundary — the zod schemas that define the trusted
 * kernel's validation layer at untrusted boundaries.
 *
 * One vocabulary per module, layered so that a module only depends on the ones
 * below it: `truth` (the epistemic pair and the source-quality ceiling) →
 * `reasoning-budget` → `governance` → `cognitive-events` → `gate-io`, with
 * `derivation-records` and `formalization` hanging off `truth` alone. A caller
 * that needs one contract imports that module rather than this barrel, and a
 * module that grows a field cannot silently widen a sibling's.
 */
export type {
  AutonomyModeChangedEvent,
  BeliefRevisedEvent,
  BudgetExhaustedEvent,
  CognitiveEvent,
  ConceptActivatedEvent,
  DerivationAcceptedEvent,
  EgressGateRejectedEvent,
  JudgmentResolvedEvent,
  PolicyViolationEvent,
  SelfModProposalEvent,
  ShadowValidationDropEvent,
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
  PolicyViolationEventSchema,
  SelfModProposalEventSchema,
  ShadowValidationDropEventSchema,
  TaskAdmittedEventSchema,
  validateCognitiveEvent,
} from './cognitive-events.js';
export type { DerivationRecord, DerivationStep } from './derivation-records.js';
export {
  DerivationRecordSchema,
  DerivationStepSchema,
  validateDerivationRecord,
} from './derivation-records.js';
export { CognitiveEventBaseSchema, EngineOriginSchema, PROPOSER_ORIGIN } from './event-base.js';
export type {
  AmbiguityFlag,
  FormalizationBatch,
  FormalizationCandidate,
  SourceSpan,
} from './formalization.js';
export {
  AmbiguityFlagSchema,
  FormalizationBatchSchema,
  FormalizationCandidateSchema,
  SourceSpanSchema,
  validateFormalizationBatch,
  validateFormalizationCandidate,
} from './formalization.js';
export type {
  ActionGateInput,
  ActionGateOutput,
  BudgetGateInput,
  BudgetGateOutput,
  BudgetOperation,
  PerceptionGateInput,
  PerceptionGateOutput,
  RewardGateInput,
  RewardGateOutput,
} from './gate-io.js';
export {
  ActionGateInputSchema,
  ActionGateOutputSchema,
  BudgetGateInputSchema,
  BudgetGateOutputSchema,
  BudgetOperationSchema,
  PerceptionGateInputSchema,
  PerceptionGateOutputSchema,
  RewardGateInputSchema,
  RewardGateOutputSchema,
} from './gate-io.js';
export type {
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
  AutonomyModeSchema,
  GameDomainSchema,
  GovernanceDecisionSchema,
  GovernanceEventSchema,
  PatchProposalSchema,
  RewardDomainSchema,
  RiskAssessmentSchema,
  RiskLevelSchema,
  SelfImprovementProposalSchema,
} from './governance.js';
export { NarEventSchemas } from './nar-events.js';
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
export type { BudgetScopeId, ReasoningBudget, TerminationReason } from './reasoning-budget.js';
export {
  BUDGET_SCOPE_IDS,
  ReasoningBudgetSchema,
  TerminationReasonSchema,
  validateReasoningBudget,
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
export type { SourceQuality, TruthValue } from './truth.js';
export { SOURCE_QUALITY_CONFIDENCE, SourceQualitySchema, TruthValueSchema } from './truth.js';
