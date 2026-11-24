/**
 * Iteration Artifact Schemas — Zod schemas for the cognitive loop's
 * iteration artifacts: Selection, Action, Judgment, Contract, Repair, Appraisal.
 *
 * These are the six canonical iteration artifact types that flow through
 * every loop cycle. Each schema validates at the boundary; invalid input
 * is rejected with a typed error. Zero `any` in the contract path.
 */

import { z } from 'zod';
import type { Term } from '../../kernel/terms';
import type { Truth, TruthValue } from '../../kernel/truth';
import type { Task, TimestampMs } from '../../kernel/types';
import {
  uuid,
  nonNegativeInt,
  positiveInt,
  unitInterval,
  intBetween,
  nonEmpty,
} from '../../config/boundary';

// ============================================================================
// Base schemas
// ============================================================================

/** Unique identifier (UUID). */
export const IterIdSchema = uuid;

/** Timestamp (milliseconds since epoch). */
export const IterTimestampSchema = nonNegativeInt;

/** Term reference (serialized). */
export const IterTermRefSchema = z.object({
  /** Term string representation. */
  term: z.string(),
  /** Term hash for quick comparison. */
  hash: z.string(),
});

/** Truth value reference (matches generated schema format). */
export const IterTruthRefSchema = z.object({
  /** Frequency component [0,1]. */
  frequency: unitInterval,
  /** Confidence component [0,1]. */
  confidence: unitInterval,
});

/** Task reference (serialized). */
export const IterTaskRefSchema = z.object({
  /** Term string representation. */
  term: z.string(),
  /** Truth value. */
  truth: IterTruthRefSchema,
  /** Task type. */
  type: z.enum(['belief', 'goal', 'question']),
  /** Priority weight. */
  priority: z.number(),
  /** Optional stamp. */
  stamp: z.object({
    id: z.string(),
    ts: z.number(),
    parents: z.array(z.string()),
    derivation: z.array(z.string()),
    evidence: z.number(),
  }).optional(),
});

/** Selection strategy. */
export const SelectionStrategySchema = z.enum([
  'utility',
  'voi',
  'epsilon_greedy',
  'thompson',
  'ucb',
  'softmax',
  'priority',
]);

/** Contract type. */
export const IterContractTypeSchema = z.enum([
  'safety',
  'liveness',
  'resource',
  'progress',
  'consistency',
  'validity',
]);

/** Contract severity. */
export const IterContractSeveritySchema = z.enum(['warning', 'error', 'critical']);

/** Anomaly type. */
export const AnomalyTypeSchema = z.enum([
  'stall',
  'divergence',
  'contradiction',
  'resource_exhaustion',
  'oracle_failure',
  'gate_failure',
  'contract_violation',
]);

/** Anomaly severity. */
export const AnomalySeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

/** Repair action type. */
export const RepairActionTypeSchema = z.enum([
  'clear_cache',
  'restart_oracle',
  'replan',
  'rollback_state',
  'recalibrate',
  'reduce_budget',
  'fallback_faculty',
  'alert_human',
]);

/** Appraisal dimension. */
export const AppraisalDimensionSchema = z.enum([
  'efficiency',
  'effectiveness',
  'coherence',
  'adaptability',
  'safety',
  'progress',
]);

/** Evidence source. */
export const EvidenceSourceSchema = z.enum(['metric', 'contract', 'oracle', 'heuristic']);

/** Trend. */
export const TrendSchema = z.enum(['improving', 'stable', 'declining']);

// ============================================================================
// 1. Selection Artifacts
// ============================================================================

/** Selection evidence. */
export const SelectionEvidenceSchema = z.object({
  source: z.enum(['faculty', 'oracle', 'memory', 'rule']),
  description: z.string(),
  strength: unitInterval,
});

/** Selection candidate. */
export const SelectionCandidateSchema = z.object({
  id: IterIdSchema,
  action: IterTaskRefSchema,
  utility: z.number(),
  voi: unitInterval,
  confidence: unitInterval,
  sourceFaculty: z.string(),
  evidence: z.array(SelectionEvidenceSchema),
  cost: nonNegativeInt,
  risk: unitInterval,
  priority: z.number(),
});

/** Scored candidate. */
export const ScoredCandidateSchema = z.object({
  candidate: SelectionCandidateSchema,
  score: z.number(),
  rank: nonNegativeInt,
});

/** Selection metadata. */
export const SelectionMetadataSchema = z.object({
  candidatesConsidered: nonNegativeInt,
  durationMs: nonNegativeInt,
  explored: z.boolean(),
  explorationParam: z.number(),
});

/** Selection result. */
export const SelectionResultSchema = z.object({
  selected: SelectionCandidateSchema.nullable(),
  scored: z.array(ScoredCandidateSchema),
  strategy: SelectionStrategySchema,
  metadata: SelectionMetadataSchema,
});

/** Selection record for history. */
export const SelectionRecordSchema = z.object({
  iteration: nonNegativeInt,
  candidateId: IterIdSchema,
  strategy: SelectionStrategySchema,
  outcome: z.object({
    success: z.boolean(),
    actualUtility: z.number(),
    actualCost: z.number(),
    reward: z.number(),
  }).optional(),
});

/** Selection context. */
export const SelectionContextSchema = z.object({
  candidates: z.array(SelectionCandidateSchema),
  beliefs: z.array(IterTaskRefSchema),
  goals: z.array(IterTaskRefSchema),
  budget: nonNegativeInt,
  urgency: unitInterval,
  riskTolerance: unitInterval,
  iteration: nonNegativeInt,
  history: z.array(SelectionRecordSchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type SelectionEvidence = z.infer<typeof SelectionEvidenceSchema>;
export type SelectionCandidate = z.infer<typeof SelectionCandidateSchema>;
export type ScoredCandidate = z.infer<typeof ScoredCandidateSchema>;
export type SelectionMetadata = z.infer<typeof SelectionMetadataSchema>;
export type SelectionResult = z.infer<typeof SelectionResultSchema>;
export type SelectionRecord = z.infer<typeof SelectionRecordSchema>;
export type SelectionContext = z.infer<typeof SelectionContextSchema>;
export type SelectionStrategy = z.infer<typeof SelectionStrategySchema>;

// ============================================================================
// 2. Action Artifacts
// ============================================================================

/** Effect result. */
export const EffectResultSchema = z.object({
  type: z.string(),
  term: IterTermRefSchema,
  success: z.boolean(),
  newTruth: IterTruthRefSchema.optional(),
});

/** Action result. */
export const ActionResultSchema = z.object({
  actionId: z.string(),
  task: IterTaskRefSchema,
  success: z.boolean(),
  output: z.unknown().optional(),
  effects: z.array(EffectResultSchema),
  durationMs: nonNegativeInt,
  error: z.string().optional(),
});

export type EffectResult = z.infer<typeof EffectResultSchema>;
export type ActionResult = z.infer<typeof ActionResultSchema>;

// ============================================================================
// 3. Judgment Artifacts
// ============================================================================

/** Judgment result. */
export const JudgmentResultSchema = z.object({
  judgmentId: z.string(),
  task: IterTaskRefSchema,
  score: unitInterval,
  confidence: unitInterval,
  details: z.record(z.string(), z.unknown()),
});

export type JudgmentResult = z.infer<typeof JudgmentResultSchema>;

// ============================================================================
// 4. Contract Artifacts
// ============================================================================

/** Contract check result. */
export const ContractCheckResultSchema = z.object({
  contractId: z.string(),
  type: IterContractTypeSchema,
  passed: z.boolean(),
  severity: IterContractSeveritySchema,
  message: z.string(),
  actual: z.unknown().optional(),
  expected: z.unknown().optional(),
  timestamp: IterTimestampSchema,
  context: z.record(z.string(), z.unknown()).optional(),
});

/** Loop contract (definition). */
export const LoopContractSchema = z.object({
  id: IterIdSchema,
  name: nonEmpty,
  type: IterContractTypeSchema,
  severity: IterContractSeveritySchema,
  description: z.string(),
  tags: z.array(z.string()),
  enabled: z.boolean(),
});

/** Contract context. */
export const ContractContextSchema = z.object({
  iteration: nonNegativeInt,
  currentTask: IterTaskRefSchema.optional(),
  focusBag: z.array(IterTaskRefSchema),
  beliefs: z.array(IterTaskRefSchema),
  goals: z.array(IterTaskRefSchema),
  previousResults: z.array(z.object({
    task: IterTaskRefSchema,
    success: z.boolean(),
    durationMs: nonNegativeInt,
    contracts: z.array(ContractCheckResultSchema),
  })),
  resources: z.object({
    tokensUsed: nonNegativeInt,
    tokensRemaining: nonNegativeInt,
    wallTimeMs: nonNegativeInt,
    cpuTimeMs: nonNegativeInt,
  }),
  oracleCalls: z.array(z.object({
    operation: z.string(),
    success: z.boolean(),
    durationMs: nonNegativeInt,
    tokensUsed: nonNegativeInt,
  })),
  clock: z.unknown(),
});

export type ContractCheckResult = z.infer<typeof ContractCheckResultSchema>;
export type LoopContract = z.infer<typeof LoopContractSchema>;
export type ContractContext = z.infer<typeof ContractContextSchema>;
export type IterContractType = z.infer<typeof IterContractTypeSchema>;
export type IterContractSeverity = z.infer<typeof IterContractSeveritySchema>;

// ============================================================================
// 5. Repair Artifacts
// ============================================================================

/** Resource usage. */
export const ResourceUsageSchema = z.object({
  cpu: unitInterval,
  memory: nonNegativeInt,
  tokensUsed: nonNegativeInt,
  tokensRemaining: nonNegativeInt,
  wallTimeMs: nonNegativeInt,
});

/** Oracle health. */
export const OracleHealthSchema = z.object({
  operation: z.string(),
  available: z.boolean(),
  errorRate: unitInterval,
  avgLatencyMs: nonNegativeInt,
});

/** Gate state. */
export const GateStateSchema = z.object({
  name: z.string(),
  consecutiveFailures: nonNegativeInt,
  lastError: z.string().optional(),
});

/** Repair action. */
export const RepairActionSchema = z.object({
  type: RepairActionTypeSchema,
  target: z.string(),
  params: z.record(z.string(), z.unknown()),
  priority: z.number(),
  estimatedRecoveryMs: nonNegativeInt,
  safe: z.boolean(),
});

/** Anomaly. */
export const AnomalySchema = z.object({
  type: AnomalyTypeSchema,
  severity: AnomalySeveritySchema,
  description: z.string(),
  detectedAt: IterTimestampSchema,
  context: z.object({
    iteration: nonNegativeInt,
    recentTasks: z.array(IterTaskRefSchema),
    beliefs: z.array(IterTaskRefSchema),
    goals: z.array(IterTaskRefSchema),
    resources: ResourceUsageSchema,
    oracleHealth: z.array(OracleHealthSchema),
    gateStates: z.array(GateStateSchema),
  }),
  suggestedRepairs: z.array(RepairActionSchema),
  id: IterIdSchema,
});

/** Repair context. */
export const RepairContextSchema = z.object({
  iteration: nonNegativeInt,
  recentTasks: z.array(IterTaskRefSchema),
  beliefs: z.array(IterTaskRefSchema),
  goals: z.array(IterTaskRefSchema),
  resources: ResourceUsageSchema,
  oracleHealth: z.array(OracleHealthSchema),
  gateStates: z.array(GateStateSchema),
  clock: z.unknown(),
});

/** Repair result. */
export const RepairResultSchema = z.object({
  anomalyId: IterIdSchema,
  actions: z.array(RepairActionSchema),
  success: z.boolean(),
  durationMs: nonNegativeInt,
  error: z.string().optional(),
  postContext: RepairContextSchema.optional(),
});

/** Repair policy. */
export const RepairPolicySchema = z.object({
  anomalyType: AnomalyTypeSchema,
  minSeverity: AnomalySeveritySchema,
  actions: z.array(RepairActionSchema),
  maxRetries: nonNegativeInt,
  cooldownMs: nonNegativeInt,
});

export type ResourceUsage = z.infer<typeof ResourceUsageSchema>;
export type OracleHealth = z.infer<typeof OracleHealthSchema>;
export type GateState = z.infer<typeof GateStateSchema>;
export type RepairAction = z.infer<typeof RepairActionSchema>;
export type Anomaly = z.infer<typeof AnomalySchema>;
export type RepairContext = z.infer<typeof RepairContextSchema>;
export type RepairResult = z.infer<typeof RepairResultSchema>;
export type RepairPolicy = z.infer<typeof RepairPolicySchema>;
export type AnomalyType = z.infer<typeof AnomalyTypeSchema>;
export type AnomalySeverity = z.infer<typeof AnomalySeveritySchema>;
export type RepairActionType = z.infer<typeof RepairActionTypeSchema>;

// ============================================================================
// 6. Appraisal Artifacts
// ============================================================================

/** Appraisal evidence. */
export const AppraisalEvidenceSchema = z.object({
  source: EvidenceSourceSchema,
  description: z.string(),
  value: z.number(),
  weight: unitInterval,
});

/** Dimension appraisal. */
export const DimensionAppraisalSchema = z.object({
  dimension: AppraisalDimensionSchema,
  score: unitInterval,
  confidence: unitInterval,
  evidence: z.array(AppraisalEvidenceSchema),
  trend: TrendSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Appraisal metrics. */
export const AppraisalMetricsSchema = z.object({
  tokensPerIteration: nonNegativeInt,
  timePerIteration: nonNegativeInt,
  oracleCallsPerIteration: nonNegativeInt,
  oracleSuccessRate: unitInterval,
  contractViolationRate: unitInterval,
  beliefGrowthRate: z.number(),
  goalAchievementRate: unitInterval,
  contradictionRate: unitInterval,
  uniqueTasksRatio: unitInterval,
  fallbackUsageRate: unitInterval,
});

/** Full appraisal result. */
export const LoopAppraisalSchema = z.object({
  overallScore: unitInterval,
  dimensions: z.array(DimensionAppraisalSchema),
  timestamp: IterTimestampSchema,
  iteration: nonNegativeInt,
  summary: z.string(),
  recommendations: z.array(z.string()),
  metrics: AppraisalMetricsSchema.optional(),
});

/** Appraisal configuration. */
export const AppraisalConfigSchema = z.object({
  weights: z.record(AppraisalDimensionSchema, unitInterval),
  minEvidence: nonNegativeInt,
  historyWindow: positiveInt,
  detailed: z.boolean(),
});

export type AppraisalEvidence = z.infer<typeof AppraisalEvidenceSchema>;
export type DimensionAppraisal = z.infer<typeof DimensionAppraisalSchema>;
export type AppraisalMetrics = z.infer<typeof AppraisalMetricsSchema>;
export type LoopAppraisal = z.infer<typeof LoopAppraisalSchema>;
export type AppraisalConfig = z.infer<typeof AppraisalConfigSchema>;
export type AppraisalDimension = z.infer<typeof AppraisalDimensionSchema>;
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;
export type Trend = z.infer<typeof TrendSchema>;

// ============================================================================
// Union and Registry
// ============================================================================

/** All iteration artifact schemas. */
export const ITERATION_ARTIFACT_SCHEMAS = {
  // Selection
  SelectionResult: SelectionResultSchema,
  SelectionCandidate: SelectionCandidateSchema,
  SelectionContext: SelectionContextSchema,
  // Action
  ActionResult: ActionResultSchema,
  EffectResult: EffectResultSchema,
  // Judgment
  JudgmentResult: JudgmentResultSchema,
  // Contract
  ContractCheckResult: ContractCheckResultSchema,
  ContractContext: ContractContextSchema,
  LoopContract: LoopContractSchema,
  // Repair
  RepairResult: RepairResultSchema,
  Anomaly: AnomalySchema,
  RepairContext: RepairContextSchema,
  RepairAction: RepairActionSchema,
  RepairPolicy: RepairPolicySchema,
  // Appraisal
  LoopAppraisal: LoopAppraisalSchema,
  DimensionAppraisal: DimensionAppraisalSchema,
  AppraisalEvidence: AppraisalEvidenceSchema,
  AppraisalConfig: AppraisalConfigSchema,
  AppraisalMetrics: AppraisalMetricsSchema,
} as const;

/** Iteration artifact type names. */
export type IterationArtifactType = keyof typeof ITERATION_ARTIFACT_SCHEMAS;

/** All iteration artifacts union. */
export const AnyIterationArtifactSchema = z.union([
  SelectionResultSchema,
  SelectionCandidateSchema,
  SelectionContextSchema,
  ActionResultSchema,
  EffectResultSchema,
  JudgmentResultSchema,
  ContractCheckResultSchema,
  ContractContextSchema,
  LoopContractSchema,
  RepairResultSchema,
  AnomalySchema,
  RepairContextSchema,
  RepairActionSchema,
  RepairPolicySchema,
  LoopAppraisalSchema,
  DimensionAppraisalSchema,
  AppraisalEvidenceSchema,
  AppraisalConfigSchema,
  AppraisalMetricsSchema,
]);

export type AnyIterationArtifact = z.infer<typeof AnyIterationArtifactSchema>;

/** Get schema by type name. */
export function getIterationArtifactSchema(type: IterationArtifactType): z.ZodSchema {
  return ITERATION_ARTIFACT_SCHEMAS[type];
}

/** Validate an iteration artifact. */
export function validateIterationArtifact<T extends AnyIterationArtifact>(
  type: IterationArtifactType,
  data: unknown
): T {
  const schema = getIterationArtifactSchema(type);
  return schema.parse(data) as T;
}

/** Safely validate an iteration artifact. */
export function safeValidateIterationArtifact<T extends AnyIterationArtifact>(
  type: IterationArtifactType,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const schema = getIterationArtifactSchema(type);
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as T };
  }
  return { success: false, error: result.error };
}

/** Validate all iteration artifacts in an iteration result. */
export function validateIterationResult(data: {
  selection?: unknown;
  actions?: unknown[];
  judgments?: unknown[];
  contracts?: unknown[];
  repairs?: unknown[];
  appraisal?: unknown;
}): {
  success: boolean;
  errors: Record<string, z.ZodError>;
} {
  const errors: Record<string, z.ZodError> = {};

  if (data.selection) {
    const result = safeValidateIterationArtifact('SelectionResult', data.selection);
    if (!result.success) errors.selection = result.error;
  }

  if (data.actions) {
    for (let i = 0; i < data.actions.length; i++) {
      const result = safeValidateIterationArtifact('ActionResult', data.actions[i]);
      if (!result.success) errors[`actions[${i}]`] = result.error;
    }
  }

  if (data.judgments) {
    for (let i = 0; i < data.judgments.length; i++) {
      const result = safeValidateIterationArtifact('JudgmentResult', data.judgments[i]);
      if (!result.success) errors[`judgments[${i}]`] = result.error;
    }
  }

  if (data.contracts) {
    for (let i = 0; i < data.contracts.length; i++) {
      const result = safeValidateIterationArtifact('ContractCheckResult', data.contracts[i]);
      if (!result.success) errors[`contracts[${i}]`] = result.error;
    }
  }

  if (data.repairs) {
    for (let i = 0; i < data.repairs.length; i++) {
      const result = safeValidateIterationArtifact('RepairResult', data.repairs[i]);
      if (!result.success) errors[`repairs[${i}]`] = result.error;
    }
  }

  if (data.appraisal) {
    const result = safeValidateIterationArtifact('LoopAppraisal', data.appraisal);
    if (!result.success) errors.appraisal = result.error;
  }

  return {
    success: Object.keys(errors).length === 0,
    errors,
  };
}