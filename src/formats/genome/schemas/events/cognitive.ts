/**
 * Cognitive event schema generators for the genome.
 */

export function generateCognitiveEventSchemas(): string[] {
  const lines: string[] = [];
  lines.push('// --- Cognitive events (kernel) ---');
  lines.push('export const StimulusSourceSchema = z.enum(STIMULUS_SOURCES);');
  lines.push('export type StimulusSource = (typeof STIMULUS_SOURCES)[number];');
  lines.push('');

  lines.push('export const TaskAdmittedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('task.admitted'),");
  lines.push('  payload: z.object({');
  lines.push('    taskId: uuid(),');
  lines.push('    term: z.string(),');
  lines.push('    taskType: TaskTypeSchema,');
  lines.push('    truth: TruthValueSchema.optional(),');
  lines.push('    source: StimulusSourceSchema,');
  lines.push('    budget: BudgetSchema,');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const DerivationAcceptedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('derivation.accepted'),");
  lines.push('  payload: z.object({');
  lines.push('    derivationId: uuid(),');
  lines.push('    ruleId: z.string(),');
  lines.push('    ruleCategory: z.enum(RULE_CATEGORIES).optional(),');
  lines.push('    premises: z.array(z.string()),');
  lines.push('    conclusion: z.string(),');
  lines.push('    truth: TruthValueSchema,');
  lines.push('    premiseTruths: z.array(TruthValueSchema).optional(),');
  lines.push('    truthFn: z.string().optional(),');
  lines.push('    evidenceLineage: z.array(uuid()),');
  lines.push("    independenceCheck: z.enum(['independent', 'dependent', 'unknown']),");
  lines.push('    cycle: nonNegativeInt().optional(),');
  lines.push('    correlationId: z.string().optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const BeliefRevisedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('belief.revised'),");
  lines.push('  payload: z.object({');
  lines.push('    term: z.string(),');
  lines.push('    oldTruth: TruthValueSchema,');
  lines.push('    newTruth: TruthValueSchema,');
  lines.push('    evidenceLineage: z.array(uuid()).optional(),');
  lines.push('    revisionRule: z.string().optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ConceptActivatedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('concept.activated'),");
  lines.push('  payload: z.object({');
  lines.push('    term: z.string(),');
  lines.push('    priority: z.number(),');
  lines.push("    activationSource: z.enum(['perception', 'goal', 'derivation', 'decay', 'associative']).optional(),");
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const BudgetExhaustedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('budget.exhausted'),");
  lines.push('  payload: z.object({');
  lines.push("    budgetType: z.enum(['cycles', 'depth', 'memory', 'llm']),");
  lines.push('    remaining: z.number(),');
  lines.push('    limit: z.number(),');
  lines.push('    terminationReason: z.enum(TERMINATION_REASONS),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const PolicyViolationEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('policy.violation'),");
  lines.push('  payload: z.object({');
  lines.push('    policyId: z.string(),');
  lines.push("    violationType: z.enum(['unauthorized-tool', 'budget-exceeded', 'epistemic-firewall', 'sandbox-escape', 'self-mod-unauthorized']),");
  lines.push('    detail: z.string(),');
  lines.push("    severity: z.enum(['warn', 'block', 'quarantine']),");
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const AutonomyModeChangedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('autonomy.mode.changed'),");
  lines.push('  payload: z.object({');
  lines.push('    previousMode: AutonomyModeSchema,');
  lines.push('    newMode: AutonomyModeSchema,');
  lines.push('    authorizedBy: AutonomyAuthoritySchema,');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const SelfModProposalEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('self-mod.proposal'),");
  lines.push('  payload: PatchProposalSchema,');
  lines.push('});');
  lines.push('');

  lines.push('export const JudgmentResolvedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('judgment.resolved'),");
  lines.push('  payload: z.object({');
  lines.push('    queryId: z.string(),');
  lines.push('    shape: z.string(), // JudgmentShapeSchema');
  lines.push('    axis: z.string(), // CognitiveAxisSchema');
  lines.push('    backendId: z.string(),');
  lines.push('    tier: z.number().int().min(0).max(3),');
  lines.push('    latencyMs: nonNegativeInt(),');
  lines.push('    entropy: z.number().optional(),');
  lines.push('    abstained: z.boolean(),');
  lines.push("    stampType: z.enum(['standard', 'provisional']),");
  lines.push('    calibrationVersion: z.string(),');
  lines.push('    encoderDigest: z.string().optional(),');
  lines.push('    modelDigest: z.string().optional(),');
  lines.push('    calibrationDigest: z.string().optional(),');
  lines.push('    inputDigest: z.string().optional(),');
  lines.push('    decisionBand: z.unknown().optional(), // BandDecisionSchema');
  lines.push('    cost: z.object({');
  lines.push('      tokensIn: nonNegativeInt(),');
  lines.push('      tokensOut: nonNegativeInt(),');
  lines.push('      computeMs: nonNegativeInt(),');
  lines.push('      memoryMb: z.number().nonnegative(),');
  lines.push('    }),');
  lines.push('  }),');
  lines.push('});');
  lines.push('export type JudgmentResolvedEvent = z.infer<typeof JudgmentResolvedEventSchema>;');
  lines.push('');

  lines.push('export const GatePassedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('gate.passed'),");
  lines.push('  payload: z.object({');
  lines.push("    gate: z.enum(['perception', 'action', 'reward', 'budget']),");
  lines.push('    score: unitInterval().optional(),');
  lines.push('    detail: z.string().optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const GateFailedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('gate.failed'),");
  lines.push('  payload: z.object({');
  lines.push("    gate: z.enum(['perception', 'action', 'reward', 'budget']),");
  lines.push('    score: unitInterval().optional(),');
  lines.push('    detail: z.string().optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const BudgetConsumedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('budget.consumed'),");
  lines.push('  payload: z.object({');
  lines.push('    budgetType: z.enum(BUDGET_TYPES),');
  lines.push('    amount: nonNegativeInt(),');
  lines.push('    remaining: nonNegativeInt(),');
  lines.push('    limit: positiveInt(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const EgressGateRejectedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('egress.gate.rejected'),");
  lines.push('  payload: z.object({');
  lines.push("    gate: z.enum(['groundedness', 'risk']),");
  lines.push('    score: unitInterval().optional(),');
  lines.push('    detail: z.string().optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ShadowValidationDropEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('shadow.validation.dropped'),");
  lines.push('  payload: z.object({');
  lines.push('    candidateTerm: z.string(),');
  lines.push("    source: z.enum(['llm', 'bridge-llm']),");
  lines.push("    conflictType: z.enum(['frequency', 'semantic']),");
  lines.push('    frequencyDelta: z.number().optional(),');
  lines.push('    semanticScore: z.number().optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ProposalSubmittedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('proposal.submitted'),");
  lines.push('  payload: z.object({');
  lines.push('    proposalId: uuid(),');
  lines.push('    kind: z.enum(PROPOSAL_KINDS),');
  lines.push('    revision: nonNegativeInt(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const SnapshotCreatedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('snapshot.created'),");
  lines.push('  payload: z.object({');
  lines.push('    snapshotId: uuid(),');
  lines.push('    cycle: nonNegativeInt(),');
  lines.push('    entryCount: positiveInt(),');
  lines.push('    hash: z.string(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const SnapshotRestoredEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('snapshot.restored'),");
  lines.push('  payload: z.object({');
  lines.push('    snapshotId: uuid(),');
  lines.push('    cycle: nonNegativeInt(),');
  lines.push('    entriesReplayed: positiveInt(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  return lines;
}