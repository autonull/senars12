/**
 * Contract Producers — factory functions for creating contract instances.
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { Term } from '../../../kernel/terms';
import type { Truth } from '../../kernel/truth';
import {
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
  type Candidate,
  type Judgment,
  type ConsequenceReport,
  type Conflict,
  type Diagnostic,
  type RepairRequest,
  type Verdict,
  type Outcome,
  type Lesson,
  type WorkItem,
  TermRefSchema,
  TruthRefSchema,
} from './schemas';

// ============================================================================
// Helper functions
// ============================================================================

/** Create a term reference from a Term. */
function termRef(term: Term): z.infer<typeof TermRefSchema> {
  return {
    term: term.toString(),
    hash: String(term.hash ?? ''),
  };
}

/** Create a truth reference from a Truth. */
function truthRef(truth: Truth): z.infer<typeof TruthRefSchema> {
  return {
    frequency: truth.f,
    confidence: truth.c,
  };
}

/** Get current timestamp. */
function now(): number {
  return Date.now();
}

// ============================================================================
// Candidate producers
// ============================================================================

export interface CreateCandidateOptions {
  term: Term;
  truth: Truth;
  kind: Candidate['kind'];
  source: Candidate['source'];
  weight?: number;
  activation?: number;
  dependencies?: string[];
  derived?: boolean;
  tags?: string[];
  priority?: number;
  margin?: number;
}

/** Create a new candidate. */
export function createCandidate(options: CreateCandidateOptions): Candidate {
  return {
    id: uuidv4(),
    term: termRef(options.term),
    truth: truthRef(options.truth),
    kind: options.kind,
    source: options.source,
    weight: options.weight ?? 1.0,
    activation: options.activation ?? 0.5,
    createdAt: now(),
    dependencies: options.dependencies ?? [],
    derived: options.derived ?? false,
    tags: options.tags ?? [],
    priority: options.priority ?? options.weight ?? 1.0,
    margin: options.margin,
  };
}

/** Create a candidate from perception. */
export function createPerceptionCandidate(term: Term, truth: Truth, weight = 1.0): Candidate {
  return createCandidate({
    term,
    truth,
    kind: 'belief',
    source: 'perception',
    weight,
    activation: 0.8,
    tags: ['perception'],
  });
}

/** Create a candidate from reflex. */
export function createReflexCandidate(term: Term, truth: Truth, weight = 0.8): Candidate {
  return createCandidate({
    term,
    truth,
    kind: 'goal',
    source: 'reflex',
    weight,
    activation: 0.7,
    tags: ['reflex'],
  });
}

/** Create a candidate from derivation. */
export function createDerivationCandidate(
  term: Term,
  truth: Truth,
  parentIds: string[],
  weight = 0.6
): Candidate {
  return createCandidate({
    term,
    truth,
    kind: 'belief',
    source: 'derivation',
    weight,
    activation: 0.5,
    dependencies: parentIds,
    derived: true,
    tags: ['derived'],
  });
}

// ============================================================================
// Judgment producers
// ============================================================================

export interface CreateJudgmentOptions {
  candidateId: string;
  score: number;
  confidence: number;
  faculty: string;
  details?: Record<string, unknown>;
  fallbackUsed?: boolean;
  evidence?: Judgment['evidence'];
}

/** Create a new judgment. */
export function createJudgment(options: CreateJudgmentOptions): Judgment {
  return {
    id: uuidv4(),
    candidateId: options.candidateId,
    score: Math.max(0, Math.min(1, options.score)),
    confidence: Math.max(0, Math.min(1, options.confidence)),
    details: options.details ?? {},
    faculty: options.faculty,
    timestamp: now(),
    fallbackUsed: options.fallbackUsed ?? false,
    evidence: options.evidence ?? [],
  };
}

/** Create a judgment from faculty output. */
export function createFacultyJudgment(
  candidateId: string,
  faculty: string,
  result: { score: number; confidence: number; details?: Record<string, unknown> },
  fallbackUsed = false,
  evidence: Judgment['evidence'] = []
): Judgment {
  return createJudgment({
    candidateId,
    score: result.score,
    confidence: result.confidence,
    faculty,
    details: result.details,
    fallbackUsed,
    evidence,
  });
}

// ============================================================================
// ConsequenceReport producers
// ============================================================================

export interface CreateConsequenceReportOptions {
  actionId: string;
  predicted: ConsequenceReport['predicted'];
  observed?: ConsequenceReport['observed'];
  totalUtilityDelta: number;
}

/** Create a new consequence report. */
export function createConsequenceReport(options: CreateConsequenceReportOptions): ConsequenceReport {
  return {
    id: uuidv4(),
    actionId: options.actionId,
    predicted: options.predicted,
    observed: options.observed,
    totalUtilityDelta: options.totalUtilityDelta,
    timestamp: now(),
  };
}

/** Add observed consequences to a report. */
export function addObservedConsequences(
  report: ConsequenceReport,
  observed: NonNullable<ConsequenceReport['observed']>
): ConsequenceReport {
  return {
    ...report,
    observed: [...(report.observed ?? []), ...observed],
    totalUtilityDelta: observed.reduce((sum, o) => sum + o.utilityDelta, report.totalUtilityDelta),
  };
}

// ============================================================================
// Conflict producers
// ============================================================================

export interface CreateConflictOptions {
  candidateIds: string[];
  type: Conflict['type'];
  severity: number;
  description: string;
  resolutions?: Conflict['resolutions'];
}

/** Create a new conflict. */
export function createConflict(options: CreateConflictOptions): Conflict {
  const resolutions = options.resolutions ?? options.candidateIds.map((id, i) => ({
    type: i === 0 ? 'drop' : 'defer',
    candidateId: id,
    reason: `${options.type} resolution`,
  }));
  return {
    id: uuidv4(),
    candidateIds: options.candidateIds,
    type: options.type,
    severity: Math.max(0, Math.min(1, options.severity)),
    description: options.description,
    detectedAt: now(),
    resolutions,
    resolved: false,
  };
}

/** Create a contradiction conflict. */
export function createContradictionConflict(
  candidateIds: string[],
  description: string,
  severity = 0.8
): Conflict {
  return createConflict({
    candidateIds,
    type: 'contradiction',
    severity,
    description,
    resolutions: candidateIds.map((id, i) => ({
      type: i === 0 ? 'drop' : 'defer',
      candidateId: id,
      reason: 'Contradiction resolution',
    })),
  });
}

/** Create a resource conflict. */
export function createResourceConflict(
  candidateIds: string[],
  resource: string,
  severity = 0.6
): Conflict {
  return createConflict({
    candidateIds,
    type: 'resource',
    severity,
    description: `Resource conflict: ${resource}`,
    resolutions: candidateIds.map((id, i) => ({
      type: i === 0 ? 'reorder' : 'defer',
      candidateId: id,
      reason: `Resource ${resource} contention`,
    })),
  });
}

// ============================================================================
// Diagnostic producers
// ============================================================================

export interface CreateDiagnosticOptions {
  type: Diagnostic['type'];
  severity: Diagnostic['severity'];
  description: string;
  context: Record<string, unknown>;
  suggestedRepairs?: Diagnostic['suggestedRepairs'];
}

/** Create a new diagnostic. */
export function createDiagnostic(options: CreateDiagnosticOptions): Diagnostic {
  return {
    id: uuidv4(),
    type: options.type,
    severity: options.severity,
    description: options.description,
    detectedAt: now(),
    context: options.context,
    suggestedRepairs: options.suggestedRepairs ?? [],
    acknowledged: false,
  };
}

/** Create a stall diagnostic. */
export function createStallDiagnostic(
  iterationsWithoutProgress: number,
  context: Record<string, unknown>
): Diagnostic {
  return createDiagnostic({
    type: 'stall',
    severity: iterationsWithoutProgress > 100 ? 'high' : 'medium',
    description: `Loop stalled for ${iterationsWithoutProgress} iterations`,
    context,
    suggestedRepairs: [
      { type: 'param_fix', description: 'Increase exploration rate', targetId: 'explorationRate' },
      { type: 'alternate_operator', description: 'Try different selection strategy' },
    ],
  });
}

/** Create a divergence diagnostic. */
export function createDivergenceDiagnostic(
  contradictionCount: number,
  context: Record<string, unknown>
): Diagnostic {
  return createDiagnostic({
    type: 'divergence',
    severity: contradictionCount > 10 ? 'high' : 'medium',
    description: `High contradiction count: ${contradictionCount}`,
    context,
    suggestedRepairs: [
      { type: 'precondition_subgoal', description: 'Add consistency check subgoal' },
      { type: 'alternate_operator', description: 'Use revision faculty' },
    ],
  });
}

// ============================================================================
// RepairRequest producers
// ============================================================================

export interface CreateRepairRequestOptions {
  diagnosticId: string;
  strategy: RepairRequest['strategy'];
  targetId: string;
  parameters?: Record<string, unknown>;
  priority?: number;
}

/** Create a new repair request. */
export function createRepairRequest(options: CreateRepairRequestOptions): RepairRequest {
  return {
    id: uuidv4(),
    diagnosticId: options.diagnosticId,
    strategy: options.strategy,
    targetId: options.targetId,
    parameters: options.parameters ?? {},
    priority: options.priority ?? 0.5,
    createdAt: now(),
    status: 'pending',
  };
}

/** Create a param fix repair request. */
export function createParamFixRepair(
  diagnosticId: string,
  targetId: string,
  parameter: string,
  newValue: unknown,
  priority = 0.7
): RepairRequest {
  return createRepairRequest({
    diagnosticId,
    strategy: 'param_fix',
    targetId,
    parameters: { parameter, newValue },
    priority,
  });
}

/** Create a precondition subgoal repair request. */
export function createPreconditionSubgoalRepair(
  diagnosticId: string,
  targetId: string,
  subgoal: string,
  priority = 0.6
): RepairRequest {
  return createRepairRequest({
    diagnosticId,
    strategy: 'precondition_subgoal',
    targetId,
    parameters: { subgoal },
    priority,
  });
}

/** Create an alternate operator repair request. */
export function createAlternateOperatorRepair(
  diagnosticId: string,
  targetId: string,
  operator: string,
  priority = 0.5
): RepairRequest {
  return createRepairRequest({
    diagnosticId,
    strategy: 'alternate_operator',
    targetId,
    parameters: { operator },
    priority,
  });
}

/** Create an explained veto repair request. */
export function createExplainedVetoRepair(
  diagnosticId: string,
  targetId: string,
  reason: string,
  priority = 0.9
): RepairRequest {
  return createRepairRequest({
    diagnosticId,
    strategy: 'explained_veto',
    targetId,
    parameters: { reason },
    priority,
  });
}

// ============================================================================
// Verdict producers
// ============================================================================

export interface CreateVerdictOptions {
  candidateId: string;
  value: Verdict['value'];
  confidence: number;
  reasoning: string;
  evidence?: Verdict['evidence'];
  deliberationDepth?: number;
  irreversibility?: Verdict['irreversibility'];
  fallbackUsed?: boolean;
}

/** Create a new verdict. */
export function createVerdict(options: CreateVerdictOptions): Verdict {
  return {
    id: uuidv4(),
    candidateId: options.candidateId,
    value: options.value,
    confidence: Math.max(0, Math.min(1, options.confidence)),
    reasoning: options.reasoning,
    evidence: options.evidence ?? [],
    deliberationDepth: options.deliberationDepth ?? 0,
    irreversibility: options.irreversibility ?? 'reversible',
    timestamp: now(),
    fallbackUsed: options.fallbackUsed ?? false,
  };
}

/** Create a proven verdict. */
export function createProvenVerdict(
  candidateId: string,
  confidence: number,
  reasoning: string,
  evidence: Verdict['evidence'] = []
): Verdict {
  return createVerdict({
    candidateId,
    value: 'proven',
    confidence,
    reasoning,
    evidence,
    irreversibility: 'reversible',
  });
}

/** Create an unchecked verdict. */
export function createUncheckedVerdict(
  candidateId: string,
  reasoning: string,
  deliberationDepth = 0
): Verdict {
  return createVerdict({
    candidateId,
    value: 'unchecked',
    confidence: 0.5,
    reasoning,
    deliberationDepth,
    irreversibility: 'semi_reversible',
  });
}

// ============================================================================
// Outcome producers
// ============================================================================

export interface CreateOutcomeOptions {
  candidateId: string;
  success: boolean;
  utility: number;
  expectedUtility: number;
  effects: Outcome['effects'];
  durationMs: number;
  error?: string;
}

/** Create a new outcome. */
export function createOutcome(options: CreateOutcomeOptions): Outcome {
  const surprise = Math.abs(options.utility - options.expectedUtility);
  return {
    id: uuidv4(),
    candidateId: options.candidateId,
    success: options.success,
    utility: options.utility,
    expectedUtility: options.expectedUtility,
    surprise,
    effects: options.effects,
    durationMs: options.durationMs,
    timestamp: now(),
    error: options.error,
  };
}

// ============================================================================
// Lesson producers
// ============================================================================

export interface CreateLessonOptions {
  outcomeId: string;
  type: Lesson['type'];
  content: Lesson['content'];
  supportingOutcomes?: string[];
  contradictingOutcomes?: string[];
  strength?: number;
}

/** Create a new lesson. */
export function createLesson(options: CreateLessonOptions): Lesson {
  const nowTs = now();
  return {
    id: uuidv4(),
    outcomeId: options.outcomeId,
    type: options.type,
    content: options.content,
    supportingOutcomes: options.supportingOutcomes ?? [],
    contradictingOutcomes: options.contradictingOutcomes ?? [],
    strength: options.strength ?? 0.5,
    createdAt: nowTs,
    lastReinforced: nowTs,
    active: true,
  };
}

/** Reinforce a lesson with new outcome. */
export function reinforceLesson(lesson: Lesson, outcomeId: string, contradicts = false): Lesson {
  return {
    ...lesson,
    supportingOutcomes: contradicts
      ? lesson.supportingOutcomes
      : [...lesson.supportingOutcomes, outcomeId],
    contradictingOutcomes: contradicts
      ? [...lesson.contradictingOutcomes, outcomeId]
      : lesson.contradictingOutcomes,
    strength: contradicts
      ? Math.max(0.1, lesson.strength - 0.1)
      : Math.min(1.0, lesson.strength + 0.05),
    lastReinforced: now(),
  };
}

// ============================================================================
// WorkItem producers
// ============================================================================

export interface CreateWorkItemOptions {
  type: WorkItem['type'];
  candidateId?: string;
  priority?: number;
  estimatedCost?: number;
  worker?: string;
  parentId?: string;
}

/** Create a new work item. */
export function createWorkItem(options: CreateWorkItemOptions): WorkItem {
  return {
    id: uuidv4(),
    type: options.type,
    candidateId: options.candidateId,
    priority: options.priority ?? 0.5,
    estimatedCost: options.estimatedCost ?? 1.0,
    status: 'queued',
    worker: options.worker,
    createdAt: now(),
    subgoalIds: [],
    parentId: options.parentId,
  };
}

/** Start a work item. */
export function startWorkItem(item: WorkItem, worker: string): WorkItem {
  return {
    ...item,
    status: 'in_progress',
    worker,
    startedAt: now(),
  };
}

/** Complete a work item. */
export function completeWorkItem(item: WorkItem, result: Record<string, unknown>): WorkItem {
  return {
    ...item,
    status: 'completed',
    actualCost: item.estimatedCost,
    completedAt: now(),
    result,
  };
}

/** Fail a work item. */
export function failWorkItem(item: WorkItem, error: string): WorkItem {
  return {
    ...item,
    status: 'failed',
    actualCost: item.estimatedCost,
    completedAt: now(),
    error,
  };
}

/** Create a subgoal work item. */
export function createSubgoalWorkItem(
  parent: WorkItem,
  type: WorkItem['type'],
  candidateId?: string
): WorkItem {
  const subgoal = createWorkItem({
    type,
    candidateId,
    priority: parent.priority * 0.8,
    estimatedCost: parent.estimatedCost * 0.5,
    parentId: parent.id,
  });
  // Also update parent's subgoalIds (mutates for convenience)
  parent.subgoalIds.push(subgoal.id);
  return subgoal;
}