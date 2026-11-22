/**
 * Contract Consumers — functions that process and act on contract instances.
 */

import type {
  Candidate,
  Judgment,
  ConsequenceReport,
  Conflict,
  Diagnostic,
  RepairRequest,
  Verdict,
  Outcome,
  Lesson,
  WorkItem,
  AnyContract,
  ContractType,
} from './schemas';
import type { Term } from '../../kernel/terms/term';
import type { Truth } from '../../kernel/truth';

// ============================================================================
// Candidate consumers
// ============================================================================

/** Convert candidate to kernel task format. */
export function candidateToTask(candidate: Candidate): {
  id: string;
  term: string;
  truth: { frequency: number; confidence: number };
  kind: Candidate['kind'];
  source: Candidate['source'];
  weight: number;
  activation: number;
} {
  return {
    id: candidate.id,
    term: candidate.term.term,
    truth: candidate.truth,
    kind: candidate.kind,
    source: candidate.source,
    weight: candidate.weight,
    activation: candidate.activation,
  };
}

/** Check if candidate is eligible for selection. */
export function isCandidateEligible(
  candidate: Candidate,
  minActivation = 0.01,
  minWeight = 0.001
): boolean {
  return (
    candidate.activation >= minActivation &&
    candidate.weight >= minWeight &&
    !candidate.tags.includes('vetoed')
  );
}

/** Compute candidate priority for scheduling. */
export function computeCandidatePriority(candidate: Candidate): number {
  const basePriority = candidate.priority * candidate.weight * candidate.activation;
  const ageBonus = Math.min(0.2, (Date.now() - candidate.createdAt) / 1e6); // max 0.2 after ~16 min
  const marginBonus = candidate.margin ? Math.max(0, candidate.margin) * 0.5 : 0;
  return basePriority + ageBonus + marginBonus;
}

/** Filter candidates by bag kind. */
export function filterCandidatesByKind(
  candidates: Candidate[],
  kind: Candidate['kind']
): Candidate[] {
  return candidates.filter(c => c.kind === kind);
}

/** Get top N candidates by priority. */
export function getTopCandidates(candidates: Candidate[], n: number): Candidate[] {
  return [...candidates]
    .sort((a, b) => computeCandidatePriority(b) - computeCandidatePriority(a))
    .slice(0, n);
}

// ============================================================================
// Judgment consumers
// ============================================================================

/** Check if judgment meets confidence threshold. */
export function isJudgmentConfident(judgment: Judgment, threshold = 0.7): boolean {
  return judgment.confidence >= threshold;
}

/** Aggregate multiple judgments for a candidate. */
export function aggregateJudgments(judgments: Judgment[]): {
  averageScore: number;
  averageConfidence: number;
  count: number;
  faculties: string[];
} {
  if (judgments.length === 0) {
    return { averageScore: 0, averageConfidence: 0, count: 0, faculties: [] };
  }
  return {
    averageScore: judgments.reduce((sum, j) => sum + j.score, 0) / judgments.length,
    averageConfidence: judgments.reduce((sum, j) => sum + j.confidence, 0) / judgments.length,
    count: judgments.length,
    faculties: [...new Set(judgments.map(j => j.faculty))],
  };
}

/** Get judgment by faculty. */
export function getJudgmentByFaculty(judgments: Judgment[], faculty: string): Judgment | undefined {
  return judgments.find(j => j.faculty === faculty);
}

// ============================================================================
// ConsequenceReport consumers
// ============================================================================

/** Compute prediction accuracy from consequence report. */
export function computePredictionAccuracy(report: ConsequenceReport): number {
  if (!report.observed || report.observed.length === 0) {
    return 0;
  }
  let totalError = 0;
  for (const obs of report.observed) {
    const pred = report.predicted.find(p => p.term.hash === obs.term.hash);
    if (pred) {
      totalError += Math.abs(pred.probability - obs.actualProbability);
    }
  }
  return 1 - totalError / report.observed.length;
}

/** Get utility surprise from consequence report. */
export function getUtilitySurprise(report: ConsequenceReport): number {
  if (!report.observed || report.observed.length === 0) {
    return 0;
  }
  const observedDelta = report.observed.reduce((sum, o) => sum + o.utilityDelta, 0);
  return Math.abs(observedDelta - report.totalUtilityDelta);
}

// ============================================================================
// Conflict consumers
// ============================================================================

/** Check if conflict is resolved. */
export function isConflictResolved(conflict: Conflict): boolean {
  return conflict.resolved;
}

/** Get unresolved conflicts. */
export function getUnresolvedConflicts(conflicts: Conflict[]): Conflict[] {
  return conflicts.filter(c => !c.resolved);
}

/** Get conflicts involving a candidate. */
export function getConflictsForCandidate(conflicts: Conflict[], candidateId: string): Conflict[] {
  return conflicts.filter(c => c.candidateIds.includes(candidateId));
}

/** Resolve a conflict with a resolution. */
export function resolveConflict(
  conflict: Conflict,
  resolution: Conflict['resolutions'][0]
): Conflict {
  return {
    ...conflict,
    resolved: true,
    resolvedAt: Date.now(),
    resolutions: [...conflict.resolutions, resolution],
  };
}

// ============================================================================
// Diagnostic consumers
// ============================================================================

/** Check if diagnostic is critical. */
export function isCriticalDiagnostic(diagnostic: Diagnostic): boolean {
  return diagnostic.severity === 'critical';
}

/** Get unacknowledged diagnostics. */
export function getUnacknowledgedDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter(d => !d.acknowledged);
}

/** Acknowledge a diagnostic. */
export function acknowledgeDiagnostic(diagnostic: Diagnostic): Diagnostic {
  return { ...diagnostic, acknowledged: true };
}

/** Get suggested repair requests from diagnostic. */
export function diagnosticToRepairRequests(
  diagnostic: Diagnostic,
  targetId: string
): Omit<RepairRequest, 'id' | 'createdAt' | 'status'>[] {
  return diagnostic.suggestedRepairs.map(repair => ({
    diagnosticId: diagnostic.id,
    strategy: repair.type,
    targetId: repair.targetId ?? targetId,
    parameters: {},
    priority: diagnostic.severity === 'critical' ? 1.0 : 0.7,
  }));
}

// ============================================================================
// RepairRequest consumers
// ============================================================================

/** Check if repair request is complete. */
export function isRepairComplete(request: RepairRequest): boolean {
  return request.status === 'completed' || request.status === 'failed' || request.status === 'vetoed';
}

/** Get pending repair requests. */
export function getPendingRepairs(requests: RepairRequest[]): RepairRequest[] {
  return requests.filter(r => r.status === 'pending');
}

/** Start a repair request. */
export function startRepair(request: RepairRequest, assignedTo: string): RepairRequest {
  return {
    ...request,
    status: 'in_progress',
    assignedTo,
  };
}

/** Complete a repair request. */
export function completeRepair(
  request: RepairRequest,
  success: boolean,
  description: string,
  newCandidateId?: string
): RepairRequest {
  return {
    ...request,
    status: success ? 'completed' : 'failed',
    completedAt: Date.now(),
    result: { success, description, newCandidateId },
  };
}

/** Veto a repair request. */
export function vetoRepair(request: RepairRequest, reason: string): RepairRequest {
  return {
    ...request,
    status: 'vetoed',
    completedAt: Date.now(),
    result: { success: false, description: `Vetoed: ${reason}` },
  };
}

// ============================================================================
// Verdict consumers
// ============================================================================

/** Check if verdict is definitive (proven or disproven). */
export function isDefinitiveVerdict(verdict: Verdict): boolean {
  return verdict.value === 'proven' || verdict.value === 'disproven';
}

/** Check if verdict allows action. */
export function verdictAllowsAction(verdict: Verdict, minConfidence = 0.7): boolean {
  return verdict.value === 'proven' && verdict.confidence >= minConfidence;
}

/** Get deliberation cost estimate. */
export function getDeliberationCost(verdict: Verdict): number {
  const baseCost = verdict.deliberationDepth * 0.1;
  const irreversibilityMultiplier =
    verdict.irreversibility === 'irreversible' ? 3 :
    verdict.irreversibility === 'semi_reversible' ? 1.5 : 1;
  return baseCost * irreversibilityMultiplier;
}

// ============================================================================
// Outcome consumers
// ============================================================================

/** Check if outcome is successful. */
export function isOutcomeSuccessful(outcome: Outcome): boolean {
  return outcome.success;
}

/** Compute outcome utility ratio (actual/expected). */
export function getUtilityRatio(outcome: Outcome): number {
  if (outcome.expectedUtility === 0) return outcome.utility > 0 ? 1 : 0;
  return outcome.utility / outcome.expectedUtility;
}

/** Check if outcome is surprising (surprise ratio > threshold). */
export function isSurprisingOutcome(outcome: Outcome, threshold = 0.3): boolean {
  if (outcome.expectedUtility === 0) return outcome.surprise > 0;
  return outcome.surprise / Math.abs(outcome.expectedUtility) > threshold;
}

/** Get effects by type. */
export function getEffectsByType(outcome: Outcome, type: string): Outcome['effects'] {
  return outcome.effects.filter(e => e.type === type);
}

// ============================================================================
// Lesson consumers
// ============================================================================

/** Check if lesson is strong enough to apply. */
export function isLessonApplicable(lesson: Lesson, threshold = 0.6): boolean {
  return lesson.active && lesson.strength >= threshold;
}

/** Get lessons by type. */
export function getLessonsByType(lessons: Lesson[], type: Lesson['type']): Lesson[] {
  return lessons.filter(l => l.type === type && l.active);
}

/** Compute lesson confidence from supporting/contradicting outcomes. */
export function computeLessonConfidence(lesson: Lesson): number {
  const total = lesson.supportingOutcomes.length + lesson.contradictingOutcomes.length;
  if (total === 0) return lesson.strength;
  const supportRatio = lesson.supportingOutcomes.length / total;
  return lesson.strength * supportRatio;
}

// ============================================================================
// WorkItem consumers
// ============================================================================

/** Check if work item is ready to execute. */
export function isWorkItemReady(item: WorkItem): boolean {
  return item.status === 'queued';
}

/** Get work items by type. */
export function getWorkItemsByType(items: WorkItem[], type: WorkItem['type']): WorkItem[] {
  return items.filter(i => i.type === type);
}

/** Get work items by status. */
export function getWorkItemsByStatus(items: WorkItem[], status: WorkItem['status']): WorkItem[] {
  return items.filter(i => i.status === status);
}

/** Compute work item queue depth. */
export function getQueueDepth(items: WorkItem[]): number {
  return items.filter(i => i.status === 'queued').length;
}

/** Get average completion time. */
export function getAverageCompletionTime(items: WorkItem[]): number {
  const completed = items.filter(
    i => i.status === 'completed' && i.startedAt && i.completedAt
  );
  if (completed.length === 0) return 0;
  return completed.reduce((sum, i) => sum + (i.completedAt! - i.startedAt!), 0) / completed.length;
}

/** Get work item tree (with subgoals). */
export function getWorkItemTree(items: WorkItem[], rootId: string): WorkItem | null {
  const root = items.find(i => i.id === rootId);
  if (!root) return null;
  const subgoals = root.subgoalIds
    .map(id => getWorkItemTree(items, id))
    .filter((i): i is WorkItem => i !== null);
  return { ...root, subgoalIds: subgoals.map(s => s.id) };
}

// ============================================================================
// Generic contract consumers
// ============================================================================

/** Get contract type from AnyContract. */
export function getContractType(contract: AnyContract): ContractType {
  if ('kind' in contract && 'source' in contract) return 'Candidate';
  if ('score' in contract && 'faculty' in contract) return 'Judgment';
  if ('predicted' in contract && 'totalUtilityDelta' in contract) return 'ConsequenceReport';
  if ('candidateIds' in contract && 'type' in contract) return 'Conflict';
  if ('type' in contract && 'suggestedRepairs' in contract) return 'Diagnostic';
  if ('diagnosticId' in contract && 'strategy' in contract) return 'RepairRequest';
  if ('value' in contract && 'deliberationDepth' in contract) return 'Verdict';
  if ('success' in contract && 'surprise' in contract) return 'Outcome';
  if ('type' in contract && 'content' in contract && 'strength' in contract) return 'Lesson';
  if ('type' in contract && 'estimatedCost' in contract) return 'WorkItem';
  throw new Error('Unknown contract type');
}

/** Serialize contract for log storage. */
export function serializeContract(contract: AnyContract): string {
  return JSON.stringify(contract);
}

/** Deserialize contract from log storage. */
export function deserializeContract(type: ContractType, data: string): AnyContract {
  return JSON.parse(data) as AnyContract;
}