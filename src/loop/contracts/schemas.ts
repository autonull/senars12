/**
 * Core Loop Contracts — Zod schemas for the cognitive loop economy.
 * These are the ten canonical contract types: Candidate, Judgment, ConsequenceReport,
 * Conflict, Diagnostic, RepairRequest, Verdict, Outcome, Lesson, WorkItem.
 */

import { z } from 'zod';
import type { Term } from '../../../kernel/terms';
import type { Truth } from '../../kernel/truth';
import { uuid, nonNegativeInt, unitInterval, nonEmpty } from '@senars/util/config';

// ============================================================================
// Base schemas
// ============================================================================

/** Unique identifier. */
export const IdSchema = uuid;

/** Timestamp (milliseconds since epoch). */
export const TimestampSchema = nonNegativeInt;

/** Term reference (serialized). */
export const TermRefSchema = z.object({
  /** Term string representation. */
  term: nonEmpty,
  /** Term hash for quick comparison. */
  hash: nonEmpty,
});

/** Truth value reference. */
export const TruthRefSchema = z.object({
  /** Frequency component [0,1]. */
  frequency: unitInterval,
  /** Confidence component [0,1]. */
  confidence: unitInterval,
});

/** Task bag kind. */
export const TaskBagKindSchema = z.enum([
  'belief',
  'goal',
  'skill',
  'faculty',
  'rule',
  'plan',
]);

/** Task source. */
export const TaskSourceSchema = z.enum([
  'perception',
  'reflex',
  'oracle',
  'derivation',
  'proposal',
  'curriculum',
  'growth',
  'repair',
]);

// ============================================================================
// 1. Candidate — a proposed task for consideration
// ============================================================================

export const CandidateSchema = z.object({
  /** Unique candidate ID. */
  id: IdSchema,
  /** The term representing this candidate. */
  term: TermRefSchema,
  /** Truth value. */
  truth: TruthRefSchema,
  /** Task bag kind. */
  kind: TaskBagKindSchema,
  /** Source of this candidate. */
  source: TaskSourceSchema,
  /** Utility weight. */
  weight: z.number().nonnegative(),
  /** Activation level [0,1]. */
  activation: unitInterval,
  /** Creation timestamp. */
  createdAt: TimestampSchema,
  /** Dependencies (candidate IDs). */
  dependencies: z.array(IdSchema),
  /** Derived from another candidate. */
  derived: z.boolean(),
  /** Tags for categorization. */
  tags: z.array(z.string()),
  /** Priority score for selection. */
  priority: z.number(),
  /** Metareasoning margin. */
  margin: z.number().optional(),
});

export type Candidate = z.infer<typeof CandidateSchema>;

// ============================================================================
// 2. Judgment — evaluation result for a candidate
// ============================================================================

export const JudgmentSchema = z.object({
  /** Unique judgment ID. */
  id: IdSchema,
  /** Candidate that was judged. */
  candidateId: IdSchema,
  /** Judgment score [0,1]. */
  score: unitInterval,
  /** Confidence in judgment [0,1]. */
  confidence: unitInterval,
  /** Judgment details. */
  details: z.record(z.string(), z.unknown()),
  /** Faculty that produced this judgment. */
  faculty: z.string(),
  /** Timestamp. */
  timestamp: TimestampSchema,
  /** Whether fallback was used. */
  fallbackUsed: z.boolean(),
  /** Evidence supporting judgment. */
  evidence: z.array(z.object({
    source: z.string(),
    description: z.string(),
    strength: unitInterval,
  })),
});

export type Judgment = z.infer<typeof JudgmentSchema>;

// ============================================================================
// 3. ConsequenceReport — predicted/observed consequences of an action
// ============================================================================

export const ConsequenceReportSchema = z.object({
  /** Unique report ID. */
  id: IdSchema,
  /** Action/candidate that produced consequences. */
  actionId: IdSchema,
  /** Predicted consequences. */
  predicted: z.array(z.object({
    term: TermRefSchema,
    probability: unitInterval,
    utilityDelta: z.number(),
  })),
  /** Observed consequences (after execution). */
  observed: z.array(z.object({
    term: TermRefSchema,
    actualProbability: unitInterval,
    utilityDelta: z.number(),
    timestamp: TimestampSchema,
  })).optional(),
  /** Overall consequence utility. */
  totalUtilityDelta: z.number(),
  /** Timestamp. */
  timestamp: TimestampSchema,
});

export type ConsequenceReport = z.infer<typeof ConsequenceReportSchema>;

// ============================================================================
// 4. Conflict — contradiction or resource conflict between candidates
// ============================================================================

export const ConflictSchema = z.object({
  /** Unique conflict ID. */
  id: IdSchema,
  /** Conflicting candidate IDs. */
  candidateIds: z.array(IdSchema).min(2),
  /** Conflict type. */
  type: z.enum([
    'contradiction',
    'resource',
    'precondition',
    'mutual_exclusion',
    'priority',
  ]),
  /** Severity [0,1]. */
  severity: unitInterval,
  /** Description. */
  description: z.string(),
  /** Detected at timestamp. */
  detectedAt: TimestampSchema,
  /** Suggested resolutions. */
  resolutions: z.array(z.object({
    type: z.enum(['drop', 'defer', 'merge', 'reorder', 'repair']),
    candidateId: IdSchema,
    reason: z.string(),
  })),
  /** Whether resolved. */
  resolved: z.boolean().default(false),
  /** Resolution timestamp. */
  resolvedAt: TimestampSchema.optional(),
});

export type Conflict = z.infer<typeof ConflictSchema>;

// ============================================================================
// 5. Diagnostic — anomaly or issue detected in the loop
// ============================================================================

export const DiagnosticSchema = z.object({
  /** Unique diagnostic ID. */
  id: IdSchema,
  /** Diagnostic type. */
  type: z.enum([
    'stall',
    'divergence',
    'resource_exhaustion',
    'oracle_failure',
    'gate_failure',
    'contract_violation',
    'utility_collapse',
    'memory_pressure',
  ]),
  /** Severity. */
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  /** Description. */
  description: z.string(),
  /** Detected at timestamp. */
  detectedAt: TimestampSchema,
  /** Context snapshot. */
  context: z.record(z.string(), z.unknown()),
  /** Suggested repairs. */
  suggestedRepairs: z.array(z.object({
    type: z.enum(['param_fix', 'precondition_subgoal', 'alternate_operator', 'explained_veto']),
    description: z.string(),
    targetId: IdSchema.optional(),
  })),
  /** Whether acknowledged. */
  acknowledged: z.boolean().default(false),
});

export type Diagnostic = z.infer<typeof DiagnosticSchema>;

// ============================================================================
// 6. RepairRequest — request to repair an issue
// ============================================================================

export const RepairRequestSchema = z.object({
  /** Unique request ID. */
  id: IdSchema,
  /** Diagnostic that triggered this repair. */
  diagnosticId: IdSchema,
  /** Repair strategy. */
  strategy: z.enum([
    'param_fix',
    'precondition_subgoal',
    'alternate_operator',
    'explained_veto',
  ]),
  /** Target candidate/task ID. */
  targetId: IdSchema,
  /** Repair parameters. */
  parameters: z.record(z.string(), z.unknown()),
  /** Priority. */
  priority: z.number(),
  /** Created at timestamp. */
  createdAt: TimestampSchema,
  /** Assigned repair agent. */
  assignedTo: z.string().optional(),
  /** Status. */
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'vetoed']).default('pending'),
  /** Result (when completed). */
  result: z.object({
    success: z.boolean(),
    description: z.string(),
    newCandidateId: IdSchema.optional(),
  }).optional(),
  /** Completed at timestamp. */
  completedAt: TimestampSchema.optional(),
});

export type RepairRequest = z.infer<typeof RepairRequestSchema>;

// ============================================================================
// 7. Verdict — three-valued decision outcome
// ============================================================================

export const VerdictSchema = z.object({
  /** Unique verdict ID. */
  id: IdSchema,
  /** Candidate/task being decided. */
  candidateId: IdSchema,
  /** Verdict value. */
  value: z.enum(['proven', 'disproven', 'unchecked']),
  /** Confidence [0,1]. */
  confidence: unitInterval,
  /** Reasoning trace. */
  reasoning: z.string(),
  /** Evidence. */
  evidence: z.array(z.object({
    source: z.string(),
    description: z.string(),
    strength: unitInterval,
  })),
  /** Deliberation depth (iterations). */
  deliberationDepth: nonNegativeInt,
  /** Irreversibility level. */
  irreversibility: z.enum(['reversible', 'semi_reversible', 'irreversible']),
  /** Timestamp. */
  timestamp: TimestampSchema,
  /** Whether from fallback. */
  fallbackUsed: z.boolean(),
});

export type Verdict = z.infer<typeof VerdictSchema>;

// ============================================================================
// 8. Outcome — result of executing a candidate
// ============================================================================

export const OutcomeSchema = z.object({
  /** Unique outcome ID. */
  id: IdSchema,
  /** Candidate that was executed. */
  candidateId: IdSchema,
  /** Execution success. */
  success: z.boolean(),
  /** Actual utility achieved. */
  utility: z.number(),
  /** Expected utility (from judgment). */
  expectedUtility: z.number(),
  /** Surprise (|actual - expected|). */
  surprise: z.number().nonnegative(),
  /** Effects applied. */
  effects: z.array(z.object({
    type: z.string(),
    term: TermRefSchema,
    success: z.boolean(),
    newTruth: TruthRefSchema.optional(),
  })),
  /** Duration (ms). */
  durationMs: nonNegativeInt,
  /** Timestamp. */
  timestamp: TimestampSchema,
  /** Error if failed. */
  error: z.string().optional(),
  /** Linked lesson ID. */
  lessonId: IdSchema.optional(),
});

export type Outcome = z.infer<typeof OutcomeSchema>;

// ============================================================================
// 9. Lesson — learned insight from outcomes
// ============================================================================

export const LessonSchema = z.object({
  /** Unique lesson ID. */
  id: IdSchema,
  /** Outcome that produced this lesson. */
  outcomeId: IdSchema,
  /** Lesson type. */
  type: z.enum([
    'utility_calibration',
    'precondition_discovery',
    'operator_effectiveness',
    'risk_factor',
    'strategy_adjustment',
    'domain_pattern',
  ]),
  /** Lesson content. */
  content: z.object({
    pattern: z.string(),
    condition: z.record(z.string(), z.unknown()),
    prediction: z.record(z.string(), z.unknown()),
    confidence: unitInterval,
  }),
  /** Supporting outcome IDs. */
  supportingOutcomes: z.array(IdSchema),
  /** Contradicting outcome IDs. */
  contradictingOutcomes: z.array(IdSchema),
  /** Strength [0,1]. */
  strength: unitInterval,
  /** Created at timestamp. */
  createdAt: TimestampSchema,
  /** Last reinforced timestamp. */
  lastReinforced: TimestampSchema,
  /** Active. */
  active: z.boolean().default(true),
});

export type Lesson = z.infer<typeof LessonSchema>;

// ============================================================================
// 10. WorkItem — unit of work in the task economy
// ============================================================================

export const WorkItemSchema = z.object({
  /** Unique work item ID. */
  id: IdSchema,
  /** Work item type. */
  type: z.enum([
    'candidate_evaluation',
    'judgment_invocation',
    'action_execution',
    'repair_execution',
    'diagnostic_check',
    'contract_check',
    'memory_consolidation',
    'schema_induction',
    'faculty_training',
    'repertoire_admission',
  ]),
  /** Candidate/task this work item relates to. */
  candidateId: IdSchema.optional(),
  /** Priority [0,1]. */
  priority: unitInterval,
  /** Estimated cost. */
  estimatedCost: z.number().nonnegative(),
  /** Actual cost (when completed). */
  actualCost: z.number().nonnegative().optional(),
  /** Status. */
  status: z.enum(['queued', 'in_progress', 'completed', 'failed', 'cancelled']).default('queued'),
  /** Assigned worker. */
  worker: z.string().optional(),
  /** Created at timestamp. */
  createdAt: TimestampSchema,
  /** Started at timestamp. */
  startedAt: TimestampSchema.optional(),
  /** Completed at timestamp. */
  completedAt: TimestampSchema.optional(),
  /** Result data. */
  result: z.record(z.string(), z.unknown()).optional(),
  /** Error if failed. */
  error: z.string().optional(),
  /** Parent work item (for subgoals). */
  parentId: IdSchema.optional(),
  /** Subgoals spawned. */
  subgoalIds: z.array(IdSchema).default([]),
});

export type WorkItem = z.infer<typeof WorkItemSchema>;

// ============================================================================
// Union and registry
// ============================================================================

/** All contract schemas. */
export const CONTRACT_SCHEMAS = {
  Candidate: CandidateSchema,
  Judgment: JudgmentSchema,
  ConsequenceReport: ConsequenceReportSchema,
  Conflict: ConflictSchema,
  Diagnostic: DiagnosticSchema,
  RepairRequest: RepairRequestSchema,
  Verdict: VerdictSchema,
  Outcome: OutcomeSchema,
  Lesson: LessonSchema,
  WorkItem: WorkItemSchema,
} as const;

/** Contract type names. */
export type ContractType = keyof typeof CONTRACT_SCHEMAS;

/** All contract types union. */
export const AnyContractSchema = z.union([
  CandidateSchema,
  JudgmentSchema,
  ConsequenceReportSchema,
  ConflictSchema,
  DiagnosticSchema,
  RepairRequestSchema,
  VerdictSchema,
  OutcomeSchema,
  LessonSchema,
  WorkItemSchema,
]);

export type AnyContract = z.infer<typeof AnyContractSchema>;

/** Get schema by type name. */
export function getContractSchema(type: ContractType): z.ZodSchema {
  return CONTRACT_SCHEMAS[type];
}

/** Validate a contract object. */
export function validateContract<T extends AnyContract>(type: ContractType, data: unknown): T {
  const schema = getContractSchema(type);
  return schema.parse(data) as T;
}

/** Safe validate a contract object. */
export function safeValidateContract<T extends AnyContract>(
  type: ContractType,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const schema = getContractSchema(type);
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as T };
  }
  return { success: false, error: result.error };
}