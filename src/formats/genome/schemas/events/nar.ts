/**
 * NAR event schema generators for the genome.
 */

export function generateNarEventSchemas(): string[] {
  const lines: string[] = [];
  lines.push('// --- Derivation records (before DerivationRecordEventSchema) ---');
  lines.push('export const RuleCategorySchema = z.enum(RULE_CATEGORIES);');
  lines.push('export type RuleCategory = (typeof RULE_CATEGORIES)[number];');
  lines.push('');

  lines.push('export const DerivationStepSchema = z.object({');
  lines.push('  stepId: uuid(),');
  lines.push('  ruleId: z.string(),');
  lines.push('  ruleCategory: RuleCategorySchema,');
  lines.push('  premises: z.array(z.string()),');
  lines.push('  conclusion: z.string(),');
  lines.push('  truth: TruthValueSchema,');
  lines.push('  truthFn: z.string().optional(),');
  lines.push('  substitution: z.record(z.string(), z.string()).optional(),');
  lines.push('  premiseTruths: z.array(TruthValueSchema).optional(),');
  lines.push('  evidenceLineage: z.array(uuid()),');
  lines.push("  independence: z.enum(['independent', 'dependent', 'unknown']),");
  lines.push('  cycle: nonNegativeInt().optional(),');
  lines.push('  correlationId: z.string().optional(),');
  lines.push('  timestamp: timestamp().optional(),');
  lines.push('});');
  lines.push('');

  lines.push('export const DerivationRecordSchema = z.object({');
  lines.push('  derivationId: uuid(),');
  lines.push('  taskId: uuid(),');
  lines.push('  goalTerm: z.string(),');
  lines.push('  steps: z.array(DerivationStepSchema),');
  lines.push('  finalTruth: TruthValueSchema,');
  lines.push('  totalCycles: nonNegativeInt(),');
  lines.push('  maxDepthReached: nonNegativeInt(),');
  lines.push('  timestamp: timestamp(),');
  lines.push("  engine: z.literal('nar'),");
  lines.push('});');
  lines.push('');
  lines.push('export type DerivationRecord = z.infer<typeof DerivationRecordSchema>;');
  lines.push('export type DerivationStep = z.infer<typeof DerivationStepSchema>;');
  lines.push('');

  lines.push('export const DerivationRecordEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('derivation.record'),");
  lines.push('  payload: DerivationRecordSchema,');
  lines.push('});');
  lines.push('');

  // --- NAR events ---
  lines.push("const NarBase = CognitiveEventBaseSchema.extend({ engine: z.literal('nar') });");
  lines.push('');

  lines.push('export const InputUserEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('input.user'),");
  lines.push('  payload: z.object({ text: z.string(), source: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const DerivationMadeEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('derivation.made'),");
  lines.push('  payload: z.object({');
  lines.push('    rule: z.string(),');
  lines.push('    premises: z.array(z.string()),');
  lines.push('    conclusion: z.string(),');
  lines.push('    cpuMs: z.number().optional(),');
  lines.push('    lmCalls: z.number().optional(),');
  lines.push('    lmTokens: z.number().optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const AtomDerivedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('atom.derived'),");
  lines.push('  payload: z.object({ atom: z.string(), space: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const AtomRetractedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('atom.retracted'),");
  lines.push('  payload: z.object({ atom: z.string(), space: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const BeliefAddedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('belief.added'),");
  lines.push('  payload: z.object({ term: z.string(), truth: TruthValueSchema }),');
  lines.push('});');
  lines.push('');

  lines.push('export const BeliefRetractedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('belief.retracted'),");
  lines.push('  payload: z.object({ term: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const DriveChangedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('drive.changed'),");
  lines.push('  payload: z.object({ drive: z.string(), urgency: z.number() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const GoalAchievedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('goal.achieved'),");
  lines.push('  payload: z.object({ goal: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const GoalFailedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('goal.failed'),");
  lines.push('  payload: z.object({ goal: z.string(), reason: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const SkillExecutedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('skill.executed'),");
  lines.push('  payload: z.object({');
  lines.push('    skill: z.string(),');
  lines.push('    args: z.array(z.string()),');
  lines.push('    result: z.string(),');
  lines.push('    durationMs: z.number(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ToolRequestEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('tool.request'),");
  lines.push('  payload: z.object({');
  lines.push('    toolName: z.string(),');
  lines.push('    args: z.record(z.string(), z.unknown()),');
  lines.push('    timeoutMs: z.number().optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ToolResponseEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('tool.response'),");
  lines.push('  payload: z.object({');
  lines.push('    requestId: z.string(),');
  lines.push('    toolName: z.string(),');
  lines.push('    result: z.unknown().optional(),');
  lines.push('    error: z.string().optional(),');
  lines.push('    durationMs: z.number(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ConfigSetEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('config.set'),");
  lines.push('  payload: z.object({ path: z.string(), value: z.unknown() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ConfigDeleteEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('config.delete'),");
  lines.push('  payload: z.object({ path: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ConfigSchemaEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('config.schema'),");
  lines.push('  payload: z.object({ schema: z.unknown() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const KernelReadyEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('kernel.ready'),");
  lines.push('  payload: z.object({ backendIds: z.array(z.string()) }),');
  lines.push('});');
  lines.push('export type KernelReadyEvent = z.infer<typeof KernelReadyEventSchema>;');
  lines.push('');

  lines.push('export const BackendRegisteredEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('backend.registered'),");
  lines.push('  payload: z.object({ manifest: z.unknown() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const BootstrapEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('bootstrap'),");
  lines.push('  payload: z.object({');
  lines.push('    beliefs: z.array(z.string()).optional(),');
  lines.push('    atoms: z.array(z.object({ atom: z.string(), space: z.string().optional() })).optional(),');
  lines.push('    skills: z.array(z.object({ name: z.string(), code: z.string() })).optional(),');
  lines.push('    restored: z.object({');
  lines.push('      cycleCount: z.number(),');
  lines.push('      concepts: z.number(),');
  lines.push('      pendingTasks: z.number(),');
  lines.push('    }).optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const CycleEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('cycle'),");
  lines.push('  cycle: z.number(),');
  lines.push('  derived: z.number(),');
  lines.push('  payload: z.object({');
  lines.push('    cycle: z.number(),');
  lines.push('    derived: z.number(),');
  lines.push('    state: z.enum(KERNEL_CONTROL_STATES),');
  lines.push('    phase: z.string(),');
  lines.push('    activeTasks: z.number(),');
  lines.push('    budget: z.record(z.string(), z.number()),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const HealthEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('health'),");
  lines.push('  payload: z.object({');
  lines.push('    status: z.enum(HEALTH_STATUSES),');
  lines.push('    cycleCount: z.number(),');
  lines.push('    errorRate: z.number(),');
  lines.push('    byEngine: z.record(z.string(), z.number()).optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ConflictDetectedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('conflict:detected'),");
  lines.push('  payload: z.object({ term: z.string(), conflictWith: z.string() }),');
  lines.push('});');
  lines.push('');

  // --- Additional NAR events for taxonomy bridge ---
  lines.push('export const MemoryPressureEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('memory.pressure'),");
  lines.push('  payload: z.object({ level: z.number(), utilization: z.number() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const MemoryConsolidatedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('memory.consolidated'),");
  lines.push('  payload: z.object({ conceptsRemoved: z.number(), conceptsArchived: z.number() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const LmCallEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('lm.call'),");
  lines.push('  payload: z.object({ modelId: z.string(), inputTokens: z.number(), outputTokens: z.number(), duration: z.number() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const LmErrorEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('lm.error'),");
  lines.push('  payload: z.object({ modelId: z.string(), error: z.string(), duration: z.number() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ErrorEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('error'),");
  lines.push('  payload: z.object({ message: z.string(), context: z.unknown().optional() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const NlAnalyzedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('nl.analyzed'),");
  lines.push('  payload: z.object({ text: z.string(), intent: z.string(), entities: z.array(z.string()) }),');
  lines.push('});');
  lines.push('');

  lines.push('export const NlTranslationEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('nl.translation'),");
  lines.push('  payload: z.object({ source: z.string(), target: z.string(), confidence: z.number() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const NlClarificationNeededEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('nl.clarification_needed'),");
  lines.push('  payload: z.object({ text: z.string(), reason: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const NalDerivedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('nal.derived'),");
  lines.push('  payload: z.object({ term: z.string(), space: z.string(), truth: z.unknown() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const LmValidationFailedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('lm.validation_failed'),");
  lines.push('  payload: z.object({ reason: z.string(), output: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const FeedbackCorrectionEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('feedback.correction'),");
  lines.push('  payload: z.object({ original: z.string(), corrected: z.string(), source: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const TurnStartEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('turn.start'),");
  lines.push('  payload: z.object({ turnId: z.string(), input: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const TurnEndEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('turn.end'),");
  lines.push('  payload: z.object({ turnId: z.string(), output: z.string(), durationMs: z.number() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const TurnErrorEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('turn.error'),");
  lines.push('  payload: z.object({ turnId: z.string(), error: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const StageStartEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('stage.start'),");
  lines.push('  payload: z.object({ stage: z.string(), turnId: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const StageEndEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('stage.end'),");
  lines.push('  payload: z.object({ stage: z.string(), turnId: z.string(), durationMs: z.number() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const StageErrorEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('stage.error'),");
  lines.push('  payload: z.object({ stage: z.string(), turnId: z.string(), error: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ClassifyResultEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('classify.result'),");
  lines.push('  payload: z.object({ category: z.string(), confidence: z.number() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const TriggerScoreEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('trigger.score'),");
  lines.push('  payload: z.object({ trigger: z.string(), score: z.number() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ReasoningStartEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('reasoning.start'),");
  lines.push('  payload: z.object({ query: z.string(), mode: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ReasoningEndEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('reasoning.end'),");
  lines.push('  payload: z.object({ query: z.string(), result: z.string(), durationMs: z.number() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const LmStartEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('lm.start'),");
  lines.push('  payload: z.object({ modelId: z.string(), prompt: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const LmChunkEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('lm.chunk'),");
  lines.push('  payload: z.object({ modelId: z.string(), chunk: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const LmEndEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('lm.end'),");
  lines.push('  payload: z.object({ modelId: z.string(), response: z.string(), durationMs: z.number() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const LmSuggestsReasoningEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('lm.suggests_reasoning'),");
  lines.push('  payload: z.object({ suggestion: z.string(), confidence: z.number() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const LmRuleExecutedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('lm_rule.executed'),");
  lines.push('  payload: z.object({ ruleId: z.string(), input: z.string(), output: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const LmRuleFailedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('lm_rule.failed'),");
  lines.push('  payload: z.object({ ruleId: z.string(), error: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const LmRuleDisabledEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('lm_rule.disabled'),");
  lines.push('  payload: z.object({ ruleId: z.string(), reason: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const DirectiveFoundEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('directive.found'),");
  lines.push('  payload: z.object({ directive: z.string(), target: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const DirectiveExecuteEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('directive.execute'),");
  lines.push('  payload: z.object({ directive: z.string(), args: z.unknown() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const DirectiveLoopRequestedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('directive.loop_requested'),");
  lines.push('  payload: z.object({ directive: z.string(), reason: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const LoopPassEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('loop.pass'),");
  lines.push('  payload: z.object({ pass: z.number(), actions: z.array(z.string()) }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ConversationMessageAddedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('conversation.message_added'),");
  lines.push('  payload: z.object({ role: z.string(), content: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ConversationArtifactAddedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('conversation.artifact_added'),");
  lines.push('  payload: z.object({ type: z.string(), content: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ConversationBeliefPinnedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('conversation.belief_pinned'),");
  lines.push('  payload: z.object({ term: z.string(), pinned: z.boolean() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ConversationSummarizedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('conversation.summarized'),");
  lines.push('  payload: z.object({ summary: z.string(), messageCount: z.number() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const SystemLmRuleAppliedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('system_lm_rule.applied'),");
  lines.push('  payload: z.object({ ruleId: z.string(), result: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const SystemLmRuleSkippedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('system_lm_rule.skipped'),");
  lines.push('  payload: z.object({ ruleId: z.string(), reason: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const SystemLmRuleStructuredEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('system_lm_rule.structured'),");
  lines.push('  payload: z.object({ ruleId: z.string(), schema: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const SystemLmRuleToolCalledEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('system_lm_rule.tool_called'),");
  lines.push('  payload: z.object({ ruleId: z.string(), tool: z.string(), args: z.unknown() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const SystemLmRuleToolResultEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('system_lm_rule.tool_result'),");
  lines.push('  payload: z.object({ ruleId: z.string(), tool: z.string(), result: z.unknown() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const SystemLmRuleFailedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('system_lm_rule.failed'),");
  lines.push('  payload: z.object({ ruleId: z.string(), error: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const SystemLmRuleCircuitOpenEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('system_lm_rule.circuit_open'),");
  lines.push('  payload: z.object({ ruleId: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const SystemLmRuleCircuitHalfOpenEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('system_lm_rule.circuit_half_open'),");
  lines.push('  payload: z.object({ ruleId: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const SystemLmRuleCircuitClosedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('system_lm_rule.circuit_closed'),");
  lines.push('  payload: z.object({ ruleId: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const NarEventSchemas = [');
  lines.push('  InputUserEventSchema,');
  lines.push('  DerivationMadeEventSchema,');
  lines.push('  AtomDerivedEventSchema,');
  lines.push('  AtomRetractedEventSchema,');
  lines.push('  BeliefAddedEventSchema,');
  lines.push('  BeliefRetractedEventSchema,');
  lines.push('  DriveChangedEventSchema,');
  lines.push('  GoalAchievedEventSchema,');
  lines.push('  GoalFailedEventSchema,');
  lines.push('  SkillExecutedEventSchema,');
  lines.push('  ToolRequestEventSchema,');
  lines.push('  ToolResponseEventSchema,');
  lines.push('  ConfigSetEventSchema,');
  lines.push('  ConfigDeleteEventSchema,');
  lines.push('  ConfigSchemaEventSchema,');
  lines.push('  KernelReadyEventSchema,');
  lines.push('  BackendRegisteredEventSchema,');
  lines.push('  BootstrapEventSchema,');
  lines.push('  CycleEventSchema,');
  lines.push('  HealthEventSchema,');
  lines.push('  ConflictDetectedEventSchema,');
  lines.push('  MemoryPressureEventSchema,');
  lines.push('  MemoryConsolidatedEventSchema,');
  lines.push('  LmCallEventSchema,');
  lines.push('  LmErrorEventSchema,');
  lines.push('  ErrorEventSchema,');
  lines.push('  NlAnalyzedEventSchema,');
  lines.push('  NlTranslationEventSchema,');
  lines.push('  NlClarificationNeededEventSchema,');
  lines.push('  NalDerivedEventSchema,');
  lines.push('  LmValidationFailedEventSchema,');
  lines.push('  FeedbackCorrectionEventSchema,');
  lines.push('  TurnStartEventSchema,');
  lines.push('  TurnEndEventSchema,');
  lines.push('  TurnErrorEventSchema,');
  lines.push('  StageStartEventSchema,');
  lines.push('  StageEndEventSchema,');
  lines.push('  StageErrorEventSchema,');
  lines.push('  ClassifyResultEventSchema,');
  lines.push('  TriggerScoreEventSchema,');
  lines.push('  ReasoningStartEventSchema,');
  lines.push('  ReasoningEndEventSchema,');
  lines.push('  LmStartEventSchema,');
  lines.push('  LmChunkEventSchema,');
  lines.push('  LmEndEventSchema,');
  lines.push('  LmSuggestsReasoningEventSchema,');
  lines.push('  LmRuleExecutedEventSchema,');
  lines.push('  LmRuleFailedEventSchema,');
  lines.push('  LmRuleDisabledEventSchema,');
  lines.push('  DirectiveFoundEventSchema,');
  lines.push('  DirectiveExecuteEventSchema,');
  lines.push('  DirectiveLoopRequestedEventSchema,');
  lines.push('  LoopPassEventSchema,');
  lines.push('  ConversationMessageAddedEventSchema,');
  lines.push('  ConversationArtifactAddedEventSchema,');
  lines.push('  ConversationBeliefPinnedEventSchema,');
  lines.push('  ConversationSummarizedEventSchema,');
  lines.push('  SystemLmRuleAppliedEventSchema,');
  lines.push('  SystemLmRuleSkippedEventSchema,');
  lines.push('  SystemLmRuleStructuredEventSchema,');
  lines.push('  SystemLmRuleToolCalledEventSchema,');
  lines.push('  SystemLmRuleToolResultEventSchema,');
  lines.push('  SystemLmRuleFailedEventSchema,');
  lines.push('  SystemLmRuleCircuitOpenEventSchema,');
  lines.push('  SystemLmRuleCircuitHalfOpenEventSchema,');
  lines.push('  SystemLmRuleCircuitClosedEventSchema,');
  lines.push('] as const;');
  lines.push('');

  return lines;
}