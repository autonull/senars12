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
  lines.push('] as const;');
  lines.push('');

  return lines;
}