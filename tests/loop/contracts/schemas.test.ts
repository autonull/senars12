/**
 * Tests for loop contract schemas, producers, and consumers.
 */

import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
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
  CONTRACT_SCHEMAS,
  AnyContractSchema,
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
  validateContract,
  safeValidateContract,
  getContractSchema,
} from '../../../src/loop/contracts/schemas';
import {
  createCandidate,
  createJudgment,
  createConsequenceReport,
  createConflict,
  createDiagnostic,
  createRepairRequest,
  createVerdict,
  createOutcome,
  createLesson,
  reinforceLesson,
  createWorkItem,
  startWorkItem,
  completeWorkItem,
  failWorkItem,
  createSubgoalWorkItem,
  createStallDiagnostic,
  createProvenVerdict,
  createUncheckedVerdict,
  createParamFixRepair,
  createPreconditionSubgoalRepair,
  createAlternateOperatorRepair,
  createExplainedVetoRepair,
} from '../../../src/loop/contracts/producers';
import {
  isCandidateEligible,
  computeCandidatePriority,
  filterCandidatesByKind,
  getTopCandidates,
  isJudgmentConfident,
  aggregateJudgments,
  computePredictionAccuracy,
  getUtilitySurprise,
  isConflictResolved,
  resolveConflict,
  isCriticalDiagnostic,
  diagnosticToRepairRequests,
  isRepairComplete,
  startRepair,
  completeRepair,
  vetoRepair,
  isDefinitiveVerdict,
  verdictAllowsAction,
  isOutcomeSuccessful,
  getUtilityRatio,
  isSurprisingOutcome,
  isLessonApplicable,
  computeLessonConfidence,
  isWorkItemReady,
  getQueueDepth,
  getAverageCompletionTime,
  getContractType,
} from '../../../src/loop/contracts/consumers';

// ============================================================================
// Test helpers
// ============================================================================

const mockTerm = { toString: () => '<test --> belief>', hash: 'abc123' };
const mockTruth = { frequency: 0.9, confidence: 0.8 };

function createMockCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: uuidv4(),
    term: { term: '<test --> belief>', hash: 'abc123' },
    truth: { frequency: 0.9, confidence: 0.8 },
    kind: 'belief',
    source: 'perception',
    weight: 1.0,
    activation: 0.5,
    createdAt: Date.now(),
    dependencies: [],
    derived: false,
    tags: [],
    priority: 1.0,
    ...overrides,
  };
}

function createMockJudgment(overrides: Partial<Judgment> = {}): Judgment {
  return {
    id: uuidv4(),
    candidateId: uuidv4(),
    score: 0.8,
    confidence: 0.9,
    details: {},
    faculty: 'inference',
    timestamp: Date.now(),
    fallbackUsed: false,
    evidence: [],
    ...overrides,
  };
}

// ============================================================================
// Schema validation tests
// ============================================================================

describe('Contract Schemas', () => {
  describe('CandidateSchema', () => {
    it('validates a valid candidate', () => {
      const candidate = createMockCandidate();
      const result = safeValidateContract('Candidate', candidate);
      expect(result.success).toBe(true);
    });

    it('rejects invalid kind', () => {
      const candidate = createMockCandidate({ kind: 'invalid' as Candidate['kind'] });
      const result = safeValidateContract('Candidate', candidate);
      expect(result.success).toBe(false);
    });

    it('rejects negative weight', () => {
      const candidate = createMockCandidate({ weight: -1 });
      const result = safeValidateContract('Candidate', candidate);
      expect(result.success).toBe(false);
    });

    it('rejects activation out of range', () => {
      const candidate = createMockCandidate({ activation: 1.5 });
      const result = safeValidateContract('Candidate', candidate);
      expect(result.success).toBe(false);
    });
  });

  describe('JudgmentSchema', () => {
    it('validates a valid judgment', () => {
      const judgment = createMockJudgment();
      const result = safeValidateContract('Judgment', judgment);
      expect(result.success).toBe(true);
    });

    it('rejects score out of range', () => {
      const judgment = createMockJudgment({ score: 1.5 });
      const result = safeValidateContract('Judgment', judgment);
      expect(result.success).toBe(false);
    });

    it('rejects confidence out of range', () => {
      const judgment = createMockJudgment({ confidence: -0.1 });
      const result = safeValidateContract('Judgment', judgment);
      expect(result.success).toBe(false);
    });
  });

  describe('ConsequenceReportSchema', () => {
    it('validates a valid consequence report', () => {
      const report = {
        id: uuidv4(),
        actionId: uuidv4(),
        predicted: [{ term: { term: '<a --> b>', hash: 'h1' }, probability: 0.8, utilityDelta: 10 }],
        totalUtilityDelta: 10,
        timestamp: Date.now(),
      };
      const result = safeValidateContract('ConsequenceReport', report);
      expect(result.success).toBe(true);
    });
  });

  describe('ConflictSchema', () => {
    it('validates a valid conflict', () => {
      const conflict = {
        id: uuidv4(),
        candidateIds: [uuidv4(), uuidv4()],
        type: 'contradiction' as const,
        severity: 0.8,
        description: 'Test conflict',
        detectedAt: Date.now(),
        resolutions: [],
        resolved: false,
      };
      const result = safeValidateContract('Conflict', conflict);
      expect(result.success).toBe(true);
    });

    it('requires at least 2 candidate IDs', () => {
      const conflict = {
        id: uuidv4(),
        candidateIds: [uuidv4()],
        type: 'contradiction' as const,
        severity: 0.8,
        description: 'Test conflict',
        detectedAt: Date.now(),
        resolutions: [],
        resolved: false,
      };
      const result = safeValidateContract('Conflict', conflict);
      expect(result.success).toBe(false);
    });
  });

  describe('DiagnosticSchema', () => {
    it('validates a valid diagnostic', () => {
      const diagnostic = {
        id: uuidv4(),
        type: 'stall' as const,
        severity: 'medium' as const,
        description: 'Test diagnostic',
        detectedAt: Date.now(),
        context: {},
        suggestedRepairs: [],
        acknowledged: false,
      };
      const result = safeValidateContract('Diagnostic', diagnostic);
      expect(result.success).toBe(true);
    });
  });

  describe('RepairRequestSchema', () => {
    it('validates a valid repair request', () => {
      const request = {
        id: uuidv4(),
        diagnosticId: uuidv4(),
        strategy: 'param_fix' as const,
        targetId: uuidv4(),
        parameters: {},
        priority: 0.5,
        createdAt: Date.now(),
        status: 'pending' as const,
      };
      const result = safeValidateContract('RepairRequest', request);
      expect(result.success).toBe(true);
    });
  });

  describe('VerdictSchema', () => {
    it('validates a valid verdict', () => {
      const verdict = {
        id: uuidv4(),
        candidateId: uuidv4(),
        value: 'proven' as const,
        confidence: 0.9,
        reasoning: 'Test reasoning',
        evidence: [],
        deliberationDepth: 3,
        irreversibility: 'reversible' as const,
        timestamp: Date.now(),
        fallbackUsed: false,
      };
      const result = safeValidateContract('Verdict', verdict);
      expect(result.success).toBe(true);
    });
  });

  describe('OutcomeSchema', () => {
    it('validates a valid outcome', () => {
      const outcome = {
        id: uuidv4(),
        candidateId: uuidv4(),
        success: true,
        utility: 10,
        expectedUtility: 8,
        surprise: 2,
        effects: [],
        durationMs: 100,
        timestamp: Date.now(),
      };
      const result = safeValidateContract('Outcome', outcome);
      expect(result.success).toBe(true);
    });
  });

  describe('LessonSchema', () => {
    it('validates a valid lesson', () => {
      const lesson = {
        id: uuidv4(),
        outcomeId: uuidv4(),
        type: 'utility_calibration' as const,
        content: { pattern: 'test', condition: {}, prediction: {}, confidence: 0.8 },
        supportingOutcomes: [],
        contradictingOutcomes: [],
        strength: 0.7,
        createdAt: Date.now(),
        lastReinforced: Date.now(),
        active: true,
      };
      const result = safeValidateContract('Lesson', lesson);
      expect(result.success).toBe(true);
    });
  });

  describe('WorkItemSchema', () => {
    it('validates a valid work item', () => {
      const item = {
        id: uuidv4(),
        type: 'candidate_evaluation' as const,
        candidateId: uuidv4(),
        priority: 0.5,
        estimatedCost: 1.0,
        status: 'queued' as const,
        createdAt: Date.now(),
        subgoalIds: [],
      };
      const result = safeValidateContract('WorkItem', item);
      expect(result.success).toBe(true);
    });
  });

  describe('AnyContractSchema', () => {
    it('validates any contract type', () => {
      const candidate = createMockCandidate();
      const result = AnyContractSchema.safeParse(candidate);
      expect(result.success).toBe(true);
    });
  });

  describe('getContractSchema', () => {
    it('returns correct schema for each type', () => {
      for (const type of Object.keys(CONTRACT_SCHEMAS)) {
        const schema = getContractSchema(type as keyof typeof CONTRACT_SCHEMAS);
        expect(schema).toBeDefined();
      }
    });
  });
});

// ============================================================================
// Producer tests
// ============================================================================

describe('Contract Producers', () => {
  describe('createCandidate', () => {
    it('creates a candidate with defaults', () => {
      const candidate = createCandidate({
        term: mockTerm,
        truth: mockTruth,
        kind: 'belief',
        source: 'perception',
      });
      expect(candidate.id).toBeDefined();
      expect(candidate.term.term).toBe('<test --> belief>');
      expect(candidate.weight).toBe(1.0);
      expect(candidate.activation).toBe(0.5);
      expect(candidate.createdAt).toBeGreaterThan(0);
    });

    it('applies custom options', () => {
      const candidate = createCandidate({
        term: mockTerm,
        truth: mockTruth,
        kind: 'goal',
        source: 'reflex',
        weight: 2.0,
        activation: 0.8,
        tags: ['urgent'],
      });
      expect(candidate.kind).toBe('goal');
      expect(candidate.weight).toBe(2.0);
      expect(candidate.activation).toBe(0.8);
      expect(candidate.tags).toContain('urgent');
    });
  });

  describe('createJudgment', () => {
    it('creates a judgment with defaults', () => {
      const judgment = createJudgment({
        candidateId: uuidv4(),
        score: 0.75,
        confidence: 0.85,
        faculty: 'inference',
      });
      expect(judgment.id).toBeDefined();
      expect(judgment.score).toBe(0.75);
      expect(judgment.confidence).toBe(0.85);
      expect(judgment.fallbackUsed).toBe(false);
    });

    it('clamps score and confidence to [0,1]', () => {
      const judgment = createJudgment({
        candidateId: uuidv4(),
        score: 1.5,
        confidence: -0.2,
        faculty: 'test',
      });
      expect(judgment.score).toBe(1.0);
      expect(judgment.confidence).toBe(0.0);
    });
  });

  describe('createConsequenceReport', () => {
    it('creates a consequence report', () => {
      const report = createConsequenceReport({
        actionId: uuidv4(),
        predicted: [{ term: { term: '<a --> b>', hash: 'h1' }, probability: 0.8, utilityDelta: 5 }],
        totalUtilityDelta: 5,
      });
      expect(report.id).toBeDefined();
      expect(report.predicted.length).toBe(1);
      expect(report.totalUtilityDelta).toBe(5);
    });
  });

  describe('createConflict', () => {
    it('creates a conflict with resolutions', () => {
      const ids = [uuidv4(), uuidv4()];
      const conflict = createConflict({
        candidateIds: ids,
        type: 'contradiction',
        severity: 0.9,
        description: 'Test',
      });
      expect(conflict.resolutions.length).toBe(2);
      expect(conflict.resolutions[0].type).toBe('drop');
      expect(conflict.resolutions[1].type).toBe('defer');
    });
  });

  describe('createDiagnostic', () => {
    it('creates a diagnostic with suggested repairs', () => {
      const diagnostic = createStallDiagnostic(50, { iteration: 100 });
      expect(diagnostic.type).toBe('stall');
      expect(diagnostic.suggestedRepairs.length).toBeGreaterThan(0);
    });
  });

  describe('createRepairRequest', () => {
    it('creates param fix repair', () => {
      const repair = createParamFixRepair(uuidv4(), uuidv4(), 'explorationRate', 0.1);
      expect(repair.strategy).toBe('param_fix');
      expect(repair.parameters.parameter).toBe('explorationRate');
      expect(repair.parameters.newValue).toBe(0.1);
    });

    it('creates precondition subgoal repair', () => {
      const repair = createPreconditionSubgoalRepair(uuidv4(), uuidv4(), 'check_consistency');
      expect(repair.strategy).toBe('precondition_subgoal');
      expect(repair.parameters.subgoal).toBe('check_consistency');
    });

    it('creates alternate operator repair', () => {
      const repair = createAlternateOperatorRepair(uuidv4(), uuidv4(), 'revision');
      expect(repair.strategy).toBe('alternate_operator');
      expect(repair.parameters.operator).toBe('revision');
    });

    it('creates explained veto repair', () => {
      const repair = createExplainedVetoRepair(uuidv4(), uuidv4(), 'Irreversible action');
      expect(repair.strategy).toBe('explained_veto');
      expect(repair.parameters.reason).toBe('Irreversible action');
      expect(repair.priority).toBe(0.9);
    });
  });

  describe('createVerdict', () => {
    it('creates a proven verdict', () => {
      const verdict = createProvenVerdict(uuidv4(), 0.95, 'Direct evidence');
      expect(verdict.value).toBe('proven');
      expect(verdict.confidence).toBe(0.95);
      expect(verdict.irreversibility).toBe('reversible');
    });

    it('creates an unchecked verdict', () => {
      const verdict = createUncheckedVerdict(uuidv4(), 'Insufficient evidence', 5);
      expect(verdict.value).toBe('unchecked');
      expect(verdict.confidence).toBe(0.5);
      expect(verdict.deliberationDepth).toBe(5);
      expect(verdict.irreversibility).toBe('semi_reversible');
    });
  });

  describe('createOutcome', () => {
    it('creates an outcome with surprise calculation', () => {
      const outcome = createOutcome({
        candidateId: uuidv4(),
        success: true,
        utility: 12,
        expectedUtility: 10,
        effects: [],
        durationMs: 50,
      });
      expect(outcome.surprise).toBe(2);
      expect(outcome.success).toBe(true);
    });
  });

  describe('createLesson', () => {
    it('creates a lesson', () => {
      const lesson = createLesson({
        outcomeId: uuidv4(),
        type: 'utility_calibration',
        content: { pattern: 'test', condition: {}, prediction: {}, confidence: 0.8 },
        supportingOutcomes: [uuidv4()],
      });
      expect(lesson.strength).toBe(0.5);
      expect(lesson.supportingOutcomes.length).toBe(1);
    });

    it('reinforces a lesson', () => {
      const lesson = createLesson({
        outcomeId: uuidv4(),
        type: 'utility_calibration',
        content: { pattern: 'test', condition: {}, prediction: {}, confidence: 0.8 },
      });
      const reinforced = reinforceLesson(lesson, uuidv4());
      expect(reinforced.strength).toBeGreaterThan(lesson.strength);
      expect(reinforced.supportingOutcomes.length).toBe(1);
    });

    it('weakens a lesson on contradiction', () => {
      const lesson = createLesson({
        outcomeId: uuidv4(),
        type: 'utility_calibration',
        content: { pattern: 'test', condition: {}, prediction: {}, confidence: 0.8 },
        strength: 0.8,
      });
      const weakened = reinforceLesson(lesson, uuidv4(), true);
      expect(weakened.strength).toBeLessThan(lesson.strength);
      expect(weakened.contradictingOutcomes.length).toBe(1);
    });
  });

  describe('createWorkItem', () => {
    it('creates a work item', () => {
      const item = createWorkItem({ type: 'candidate_evaluation' });
      expect(item.status).toBe('queued');
      expect(item.priority).toBe(0.5);
    });

    it('starts a work item', () => {
      const item = createWorkItem({ type: 'action_execution' });
      const started = startWorkItem(item, 'worker-1');
      expect(started.status).toBe('in_progress');
      expect(started.worker).toBe('worker-1');
      expect(started.startedAt).toBeDefined();
    });

    it('completes a work item', () => {
      const item = createWorkItem({ type: 'judgment_invocation' });
      const completed = completeWorkItem(item, { result: 'success' });
      expect(completed.status).toBe('completed');
      expect(completed.result).toEqual({ result: 'success' });
      expect(completed.completedAt).toBeDefined();
    });

    it('fails a work item', () => {
      const item = createWorkItem({ type: 'repair_execution' });
      const failed = failWorkItem(item, 'Oracle unavailable');
      expect(failed.status).toBe('failed');
      expect(failed.error).toBe('Oracle unavailable');
    });

    it('creates subgoal work items', () => {
      const parent = createWorkItem({ type: 'candidate_evaluation', priority: 1.0, estimatedCost: 10 });
      const subgoal = createSubgoalWorkItem(parent, 'judgment_invocation');
      expect(subgoal.parentId).toBe(parent.id);
      expect(subgoal.priority).toBe(0.8);
      expect(subgoal.estimatedCost).toBe(5);
      expect(parent.subgoalIds).toContain(subgoal.id);
    });
  });
});

// ============================================================================
// Consumer tests
// ============================================================================

describe('Contract Consumers', () => {
  describe('Candidate consumers', () => {
    it('checks candidate eligibility', () => {
      const candidate = createMockCandidate({ activation: 0.5, weight: 1.0 });
      expect(isCandidateEligible(candidate)).toBe(true);
    });

    it('rejects low activation candidate', () => {
      const candidate = createMockCandidate({ activation: 0.001 });
      expect(isCandidateEligible(candidate, 0.01)).toBe(false);
    });

    it('rejects low weight candidate', () => {
      const candidate = createMockCandidate({ weight: 0.0001 });
      expect(isCandidateEligible(candidate, 0.01, 0.001)).toBe(false);
    });

    it('rejects vetoed candidate', () => {
      const candidate = createMockCandidate({ tags: ['vetoed'] });
      expect(isCandidateEligible(candidate)).toBe(false);
    });

    it('computes candidate priority', () => {
      const candidate = createMockCandidate({ priority: 2.0, weight: 1.5, activation: 0.8 });
      const priority = computeCandidatePriority(candidate);
      expect(priority).toBeGreaterThan(2.0);
    });

    it('filters candidates by kind', () => {
      const candidates = [
        createMockCandidate({ kind: 'belief' }),
        createMockCandidate({ kind: 'goal' }),
        createMockCandidate({ kind: 'belief' }),
      ];
      const beliefs = filterCandidatesByKind(candidates, 'belief');
      expect(beliefs.length).toBe(2);
    });

    it('gets top candidates by priority', () => {
      const candidates = [
        createMockCandidate({ id: '1', priority: 1.0, weight: 1.0, activation: 0.5 }),
        createMockCandidate({ id: '2', priority: 2.0, weight: 1.0, activation: 0.5 }),
        createMockCandidate({ id: '3', priority: 3.0, weight: 1.0, activation: 0.5 }),
      ];
      const top = getTopCandidates(candidates, 2);
      expect(top.length).toBe(2);
      expect(top[0].id).toBe('3');
      expect(top[1].id).toBe('2');
    });
  });

  describe('Judgment consumers', () => {
    it('checks judgment confidence', () => {
      const judgment = createMockJudgment({ confidence: 0.8 });
      expect(isJudgmentConfident(judgment, 0.7)).toBe(true);
      expect(isJudgmentConfident(judgment, 0.9)).toBe(false);
    });

    it('aggregates judgments', () => {
      const judgments = [
        createMockJudgment({ score: 0.8, confidence: 0.9, faculty: 'inference' }),
        createMockJudgment({ score: 0.6, confidence: 0.7, faculty: 'abduction' }),
        createMockJudgment({ score: 0.9, confidence: 0.8, faculty: 'inference' }),
      ];
      const agg = aggregateJudgments(judgments);
      expect(agg.count).toBe(3);
      expect(agg.averageScore).toBeCloseTo(0.767, 2);
      expect(agg.faculties).toContain('inference');
      expect(agg.faculties).toContain('abduction');
    });
  });

  describe('ConsequenceReport consumers', () => {
    it('computes prediction accuracy', () => {
      const report = createConsequenceReport({
        actionId: uuidv4(),
        predicted: [{ term: { term: '<a --> b>', hash: 'h1' }, probability: 0.8, utilityDelta: 5 }],
        observed: [{ term: { term: '<a --> b>', hash: 'h1' }, actualProbability: 0.75, utilityDelta: 4, timestamp: Date.now() }],
        totalUtilityDelta: 5,
      });
      const accuracy = computePredictionAccuracy(report);
      expect(accuracy).toBeCloseTo(0.95, 1);
    });

    it('computes utility surprise', () => {
      const report = createConsequenceReport({
        actionId: uuidv4(),
        predicted: [{ term: { term: '<a --> b>', hash: 'h1' }, probability: 0.8, utilityDelta: 5 }],
        observed: [{ term: { term: '<a --> b>', hash: 'h1' }, actualProbability: 0.8, utilityDelta: 10, timestamp: Date.now() }],
        totalUtilityDelta: 5,
      });
      const surprise = getUtilitySurprise(report);
      expect(surprise).toBe(5);
    });
  });

  describe('Conflict consumers', () => {
    it('checks resolution status', () => {
      const conflict = createConflict({ candidateIds: [uuidv4(), uuidv4()], type: 'contradiction', severity: 0.5, description: 'test' });
      expect(isConflictResolved(conflict)).toBe(false);
      const resolved = resolveConflict(conflict, { type: 'drop', candidateId: conflict.candidateIds[0], reason: 'test' });
      expect(isConflictResolved(resolved)).toBe(true);
    });
  });

  describe('Diagnostic consumers', () => {
    it('identifies critical diagnostics', () => {
      const critical = createDiagnostic({ type: 'resource_exhaustion', severity: 'critical', description: 'OOM', context: {} });
      expect(isCriticalDiagnostic(critical)).toBe(true);
      const medium = createDiagnostic({ type: 'stall', severity: 'medium', description: 'slow', context: {} });
      expect(isCriticalDiagnostic(medium)).toBe(false);
    });

    it('generates repair requests from diagnostic', () => {
      const diagnostic = createStallDiagnostic(50, {});
      const repairs = diagnosticToRepairRequests(diagnostic, uuidv4());
      expect(repairs.length).toBeGreaterThan(0);
      expect(repairs[0].strategy).toBeDefined();
    });
  });

  describe('RepairRequest consumers', () => {
    it('tracks repair status', () => {
      const request = createRepairRequest({ diagnosticId: uuidv4(), strategy: 'param_fix', targetId: uuidv4() });
      expect(isRepairComplete(request)).toBe(false);
      const started = startRepair(request, 'worker-1');
      expect(started.status).toBe('in_progress');
      const completed = completeRepair(started, true, 'Fixed');
      expect(isRepairComplete(completed)).toBe(true);
      expect(completed.result?.success).toBe(true);
    });

    it('vetoes repair', () => {
      const request = createRepairRequest({ diagnosticId: uuidv4(), strategy: 'alternate_operator', targetId: uuidv4() });
      const vetoed = vetoRepair(request, 'Too risky');
      expect(vetoed.status).toBe('vetoed');
      expect(vetoed.result?.success).toBe(false);
    });
  });

  describe('Verdict consumers', () => {
    it('checks definitive verdicts', () => {
      const proven = createProvenVerdict(uuidv4(), 0.9, 'Evidence');
      const unchecked = createUncheckedVerdict(uuidv4(), 'Unknown');
      expect(isDefinitiveVerdict(proven)).toBe(true);
      expect(isDefinitiveVerdict(unchecked)).toBe(false);
    });

    it('checks if verdict allows action', () => {
      const highConf = createProvenVerdict(uuidv4(), 0.9, 'Evidence');
      const lowConf = createProvenVerdict(uuidv4(), 0.5, 'Weak evidence');
      const unchecked = createUncheckedVerdict(uuidv4(), 'Unknown');
      expect(verdictAllowsAction(highConf, 0.7)).toBe(true);
      expect(verdictAllowsAction(lowConf, 0.7)).toBe(false);
      expect(verdictAllowsAction(unchecked, 0.7)).toBe(false);
    });
  });

  describe('Outcome consumers', () => {
    it('checks outcome success', () => {
      const success = createOutcome({ candidateId: uuidv4(), success: true, utility: 10, expectedUtility: 8, effects: [], durationMs: 10 });
      const failure = createOutcome({ candidateId: uuidv4(), success: false, utility: 0, expectedUtility: 8, effects: [], durationMs: 10 });
      expect(isOutcomeSuccessful(success)).toBe(true);
      expect(isOutcomeSuccessful(failure)).toBe(false);
    });

    it('computes utility ratio', () => {
      const outcome = createOutcome({ candidateId: uuidv4(), success: true, utility: 12, expectedUtility: 10, effects: [], durationMs: 10 });
      expect(getUtilityRatio(outcome)).toBe(1.2);
    });

    it('detects surprising outcomes', () => {
      const surprising = createOutcome({ candidateId: uuidv4(), success: true, utility: 20, expectedUtility: 10, effects: [], durationMs: 10 });
      const expected = createOutcome({ candidateId: uuidv4(), success: true, utility: 11, expectedUtility: 10, effects: [], durationMs: 10 });
      expect(isSurprisingOutcome(surprising, 0.3)).toBe(true);
      expect(isSurprisingOutcome(expected, 0.3)).toBe(false);
    });
  });

  describe('Lesson consumers', () => {
    it('checks lesson applicability', () => {
      const strong = createLesson({ outcomeId: uuidv4(), type: 'utility_calibration', content: { pattern: '', condition: {}, prediction: {}, confidence: 0.8 }, strength: 0.8 });
      const weak = createLesson({ outcomeId: uuidv4(), type: 'utility_calibration', content: { pattern: '', condition: {}, prediction: {}, confidence: 0.8 }, strength: 0.4 });
      expect(isLessonApplicable(strong, 0.6)).toBe(true);
      expect(isLessonApplicable(weak, 0.6)).toBe(false);
    });

    it('computes lesson confidence', () => {
      const lesson = createLesson({
        outcomeId: uuidv4(),
        type: 'utility_calibration',
        content: { pattern: '', condition: {}, prediction: {}, confidence: 0.8 },
        supportingOutcomes: [uuidv4(), uuidv4(), uuidv4()],
        contradictingOutcomes: [uuidv4()],
        strength: 0.8,
      });
      const confidence = computeLessonConfidence(lesson);
      expect(confidence).toBeCloseTo(0.6, 1); // 0.8 * (3/4)
    });
  });

  describe('WorkItem consumers', () => {
    it('checks work item readiness', () => {
      const item = createWorkItem({ type: 'candidate_evaluation' });
      expect(isWorkItemReady(item)).toBe(true);
      const started = startWorkItem(item, 'w1');
      expect(isWorkItemReady(started)).toBe(false);
    });

    it('computes queue depth', () => {
      const items = [
        createWorkItem({ type: 'a' }),
        createWorkItem({ type: 'b' }),
        startWorkItem(createWorkItem({ type: 'c' }), 'w1'),
        completeWorkItem(createWorkItem({ type: 'd' }), {}),
      ];
      expect(getQueueDepth(items)).toBe(2);
    });

    it('computes average completion time', () => {
      const now = Date.now();
      const item1 = { ...createWorkItem({ type: 'a' }), startedAt: now - 1000, completedAt: now, status: 'completed' as const };
      const item2 = { ...createWorkItem({ type: 'b' }), startedAt: now - 2000, completedAt: now, status: 'completed' as const };
      const avg = getAverageCompletionTime([item1, item2]);
      expect(avg).toBe(1500);
    });
  });

  describe('Generic consumers', () => {
    it('identifies contract types', () => {
      const candidate = createMockCandidate();
      const judgment = createMockJudgment();
      expect(getContractType(candidate)).toBe('Candidate');
      expect(getContractType(judgment)).toBe('Judgment');
    });
  });
});