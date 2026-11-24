/**
 * Union types and validator generators for the genome.
 */

export function generateUnionSchemas(): string[] {
  const lines: string[] = [];
  lines.push('// --- Union types and validators (at the end) ---');
  lines.push('export const CognitiveEventSchema = z.discriminatedUnion(\'type\', [');
  lines.push('  TaskAdmittedEventSchema,');
  lines.push('  DerivationAcceptedEventSchema,');
  lines.push('  DerivationRecordEventSchema,');
  lines.push('  BeliefRevisedEventSchema,');
  lines.push('  ConceptActivatedEventSchema,');
  lines.push('  BudgetExhaustedEventSchema,');
  lines.push('  BudgetConsumedEventSchema,');
  lines.push('  PolicyViolationEventSchema,');
  lines.push('  AutonomyModeChangedEventSchema,');
  lines.push('  SelfModProposalEventSchema,');
  lines.push('  JudgmentResolvedEventSchema,');
  lines.push('  GatePassedEventSchema,');
  lines.push('  GateFailedEventSchema,');
  lines.push('  EgressGateRejectedEventSchema,');
  lines.push('  ShadowValidationDropEventSchema,');
  lines.push('  ProposalSubmittedEventSchema,');
  lines.push('  ProposalAdmittedEventSchema,');
  lines.push('  ProposalRejectedEventSchema,');
  lines.push('  SnapshotCreatedEventSchema,');
  lines.push('  SnapshotRestoredEventSchema,');
  lines.push('  ...NarEventSchemas,');
  lines.push(']);');
  lines.push('');

  lines.push('export type CognitiveEvent = z.infer<typeof CognitiveEventSchema>;');
  lines.push('export type TaskAdmittedEvent = z.infer<typeof TaskAdmittedEventSchema>;');
  lines.push('export type DerivationAcceptedEvent = z.infer<typeof DerivationAcceptedEventSchema>;');
  lines.push('export type DerivationRecordEvent = z.infer<typeof DerivationRecordEventSchema>;');
  lines.push('export type BeliefRevisedEvent = z.infer<typeof BeliefRevisedEventSchema>;');
  lines.push('export type ConceptActivatedEvent = z.infer<typeof ConceptActivatedEventSchema>;');
  lines.push('export type BudgetExhaustedEvent = z.infer<typeof BudgetExhaustedEventSchema>;');
  lines.push('export type BudgetConsumedEvent = z.infer<typeof BudgetConsumedEventSchema>;');
  lines.push('export type PolicyViolationEvent = z.infer<typeof PolicyViolationEventSchema>;');
  lines.push('export type AutonomyModeChangedEvent = z.infer<typeof AutonomyModeChangedEventSchema>;');
  lines.push('export type SelfModProposalEvent = z.infer<typeof SelfModProposalEventSchema>;');
  lines.push('export type GatePassedEvent = z.infer<typeof GatePassedEventSchema>;');
  lines.push('export type GateFailedEvent = z.infer<typeof GateFailedEventSchema>;');
  lines.push('export type EgressGateRejectedEvent = z.infer<typeof EgressGateRejectedEventSchema>;');
  lines.push('export type ShadowValidationDropEvent = z.infer<typeof ShadowValidationDropEventSchema>;');
  lines.push('export type ProposalSubmittedEvent = z.infer<typeof ProposalSubmittedEventSchema>;');
  lines.push('export type ProposalAdmittedEvent = z.infer<typeof ProposalAdmittedEventSchema>;');
  lines.push('export type ProposalRejectedEvent = z.infer<typeof ProposalRejectedEventSchema>;');
  lines.push('export type SnapshotCreatedEvent = z.infer<typeof SnapshotCreatedEventSchema>;');
  lines.push('export type SnapshotRestoredEvent = z.infer<typeof SnapshotRestoredEventSchema>;');
  lines.push('');

  // NAR event types
  lines.push('export type InputUserEvent = z.infer<typeof InputUserEventSchema>;');
  lines.push('export type DerivationMadeEvent = z.infer<typeof DerivationMadeEventSchema>;');
  lines.push('export type AtomDerivedEvent = z.infer<typeof AtomDerivedEventSchema>;');
  lines.push('export type AtomRetractedEvent = z.infer<typeof AtomRetractedEventSchema>;');
  lines.push('export type BeliefAddedEvent = z.infer<typeof BeliefAddedEventSchema>;');
  lines.push('export type BeliefRetractedEvent = z.infer<typeof BeliefRetractedEventSchema>;');
  lines.push('export type GoalAchievedEvent = z.infer<typeof GoalAchievedEventSchema>;');
  lines.push('export type GoalFailedEvent = z.infer<typeof GoalFailedEventSchema>;');
  lines.push('export type SkillExecutedEvent = z.infer<typeof SkillExecutedEventSchema>;');
  lines.push('export type ToolRequestEvent = z.infer<typeof ToolRequestEventSchema>;');
  lines.push('export type ToolResponseEvent = z.infer<typeof ToolResponseEventSchema>;');
  lines.push('export type ConflictDetectedEvent = z.infer<typeof ConflictDetectedEventSchema>;');
  lines.push('export type ConfigDeleteEvent = z.infer<typeof ConfigDeleteEventSchema>;');
  lines.push('export type ConfigSchemaEvent = z.infer<typeof ConfigSchemaEventSchema>;');
  lines.push('export type ConfigSetEvent = z.infer<typeof ConfigSetEventSchema>;');
  lines.push('export type BootstrapEvent = z.infer<typeof BootstrapEventSchema>;');
  lines.push('export type CycleEvent = z.infer<typeof CycleEventSchema>;');
  lines.push('export type HealthEvent = z.infer<typeof HealthEventSchema>;');
  lines.push('export type DriveChangedEvent = z.infer<typeof DriveChangedEventSchema>;');
  lines.push('export type BackendRegisteredEvent = z.infer<typeof BackendRegisteredEventSchema>;');
  lines.push('');

  lines.push('export type CognitiveEventOf<T extends CognitiveEvent[\'type\']> = Extract<CognitiveEvent, { type: T }>;');
  lines.push('');

  lines.push('export const validateCognitiveEvent = (data: unknown) => CognitiveEventSchema.parse(data);');
  lines.push('export const validateProposal = (data: unknown) => ProposalSchema.parse(data);');
  lines.push('export const validateFormalizationCandidate = (data: unknown) => FormalizationCandidateSchema.parse(data);');
  lines.push('export const validateFormalizationBatch = (data: unknown) => FormalizationBatchSchema.parse(data);');
  lines.push('export const validateDerivationRecord = (data: unknown) => DerivationRecordSchema.parse(data);');
  lines.push('export const validateReasoningBudget = (data: unknown) => ReasoningBudgetSchema.parse(data);');
  lines.push('export const validateRuleTable = (data: unknown) => RuleTableSchema.parse(data);');
  lines.push('');

  // Durable and recalled event types - inlined to avoid Defs reference
  lines.push('const durableEventTypes = [');
  lines.push('  "task.admitted","derivation.accepted","derivation.record","belief.added",');
  lines.push('  "belief.retracted","belief.revised","atom.derived","atom.retracted",');
  lines.push('  "goal.achieved","goal.failed","skill.executed","tool.response",');
  lines.push('  "conflict:detected","budget.exhausted","policy.violation","autonomy.mode.changed",');
  lines.push('  "egress.gate.rejected","shadow.validation.dropped","proposal.admitted",');
  lines.push('  "proposal.rejected","self-mod.proposal","bootstrap"');
  lines.push('] as const;');
  lines.push('export const DURABLE_EVENT_TYPES = new Set(durableEventTypes);');
  lines.push('');

  lines.push('const recalledEventTypesArr = [');
  lines.push('  "input.user","belief.added","belief.retracted","belief.revised",');
  lines.push('  "task.admitted","derivation.accepted","tool.request","tool.response",');
  lines.push('  "skill.executed","goal.achieved","goal.failed","conflict:detected",');
  lines.push('  "policy.violation","budget.exhausted","autonomy.mode.changed"');
  lines.push('] as const;');
  lines.push('export const RECALLED_EVENT_TYPES = new Set(recalledEventTypesArr);');
  lines.push('');

  lines.push('export const isDurableEvent = (event: { type: string }): boolean => DURABLE_EVENT_TYPES.has(event.type as typeof durableEventTypes[number]);');
  lines.push('');

  lines.push('export const recalledEventTypes = (): string[] => [...RECALLED_EVENT_TYPES];');
  lines.push('');

  lines.push('const nonExecutingModes = new Set(["observe-only", "propose-only"] as const);');
  lines.push('export const permitsExecution = (mode: AutonomyMode): boolean => !nonExecutingModes.has(mode as "observe-only" | "propose-only");');
  lines.push('');

  lines.push('export const riskLevelOf = (risk: "low" | "medium" | "high"): "LOW" | "MEDIUM" | "HIGH" => ({"low":"LOW","medium":"MEDIUM","high":"HIGH"} as const)[risk];');
  lines.push('');

  lines.push("export const isNarEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { engine: 'nar' }> => e.engine === 'nar';");
  lines.push('');

  lines.push('export const isEventType = <T extends CognitiveEvent[\'type\']>(type: T) => (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: T }> => e.type === type;');
  lines.push('');

  // --- Mint function ---
  lines.push('type Mintable<T extends CognitiveEvent[\'type\']> = Omit<');
  lines.push('  CognitiveEventOf<T>,');
  lines.push("  'type' | 'engine' | 'timestamp' | 'correlationId' | 'causationId'");
  lines.push('> & {');
  lines.push('  engine: CognitiveEvent[\'engine\'];');
  lines.push('  timestamp?: number;');
  lines.push('  correlationId?: string;');
  lines.push('  causationId?: string;');
  lines.push('};');
  lines.push('');

  lines.push('export const mintCognitiveEvent = <T extends CognitiveEvent[\'type\']>(');
  lines.push('  type: T,');
  lines.push('  draft: Mintable<T>');
  lines.push('): CognitiveEventOf<T> =>');
  lines.push('  ({');
  lines.push('    ...draft,');
  lines.push('    type,');
  lines.push('    timestamp: draft.timestamp ?? Date.now(),');
  lines.push("    correlationId: draft.correlationId ?? generateId('corr'),");
  lines.push('  }) as CognitiveEventOf<T>;');
  lines.push('');

  return lines;
}