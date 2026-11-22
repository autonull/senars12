/**
 * Tests for iteration artifact schemas.
 */

import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {
  // Selection
  SelectionResultSchema,
  SelectionCandidateSchema,
  SelectionContextSchema,
  SelectionEvidenceSchema,
  ScoredCandidateSchema,
  SelectionMetadataSchema,
  SelectionStrategySchema,
  SelectionRecordSchema,
  // Action
  ActionResultSchema,
  EffectResultSchema,
  // Judgment
  JudgmentResultSchema,
  // Contract
  ContractCheckResultSchema,
  ContractContextSchema,
  LoopContractSchema,
  IterContractTypeSchema,
  IterContractSeveritySchema,
  // Repair
  RepairResultSchema,
  AnomalySchema,
  RepairContextSchema,
  RepairActionSchema,
  RepairPolicySchema,
  AnomalyTypeSchema,
  AnomalySeveritySchema,
  RepairActionTypeSchema,
  ResourceUsageSchema,
  OracleHealthSchema,
  GateStateSchema,
  // Appraisal
  LoopAppraisalSchema,
  DimensionAppraisalSchema,
  AppraisalEvidenceSchema,
  AppraisalConfigSchema,
  AppraisalMetricsSchema,
  AppraisalDimensionSchema,
  EvidenceSourceSchema,
  TrendSchema,
  // Registry
  ITERATION_ARTIFACT_SCHEMAS,
  AnyIterationArtifactSchema,
  getIterationArtifactSchema,
  validateIterationArtifact,
  safeValidateIterationArtifact,
  validateIterationResult,
  type SelectionResult,
  type SelectionCandidate,
  type SelectionContext,
  type ActionResult,
  type JudgmentResult,
  type ContractCheckResult,
  type ContractContext,
  type RepairResult,
  type Anomaly,
  type RepairContext,
  type LoopAppraisal,
} from '../../../src/loop/contracts/iteration-schemas';

// ============================================================================
// Test helpers
// ============================================================================

const mockTaskRef = {
  term: '<test --> belief>',
  truth: { frequency: 0.9, confidence: 0.8 },
  type: 'belief' as const,
  priority: 1.0,
};

const mockTermRef = { term: '<test --> belief>', hash: 'abc123' };
const mockTruthRef = { frequency: 0.9, confidence: 0.8 };

function createMockSelectionCandidate(overrides: Partial<SelectionCandidate> = {}): SelectionCandidate {
  return {
    id: uuidv4(),
    action: mockTaskRef,
    utility: 0.8,
    voi: 0.5,
    confidence: 0.9,
    sourceFaculty: 'inference',
    evidence: [{ source: 'faculty', description: 'test', strength: 0.8 }],
    cost: 1.0,
    risk: 0.2,
    priority: 0.7,
    ...overrides,
  };
}

function createMockSelectionResult(overrides: Partial<SelectionResult> = {}): SelectionResult {
  const candidate = createMockSelectionCandidate();
  return {
    selected: candidate,
    scored: [{ candidate, score: 0.85, rank: 0 }],
    strategy: 'utility',
    metadata: {
      candidatesConsidered: 5,
      durationMs: 10,
      explored: false,
      explorationParam: 0.1,
    },
    ...overrides,
  };
}

function createMockActionResult(overrides: Partial<ActionResult> = {}): ActionResult {
  return {
    actionId: `action-${uuidv4()}`,
    task: mockTaskRef,
    success: true,
    output: { result: 'success' },
    effects: [{ type: 'belief_update', term: mockTermRef, success: true, newTruth: mockTruthRef }],
    durationMs: 50,
    ...overrides,
  };
}

function createMockJudgmentResult(overrides: Partial<JudgmentResult> = {}): JudgmentResult {
  return {
    judgmentId: `judgment-${uuidv4()}`,
    task: mockTaskRef,
    score: 0.85,
    confidence: 0.9,
    details: { actions: 3, successes: 3 },
    ...overrides,
  };
}

function createMockContractCheckResult(overrides: Partial<ContractCheckResult> = {}): ContractCheckResult {
  return {
    contractId: 'safety.budget_positive',
    type: 'safety',
    passed: true,
    severity: 'error',
    message: 'Budget is positive',
    timestamp: Date.now(),
    ...overrides,
  };
}

function createMockRepairResult(overrides: Partial<RepairResult> = {}): RepairResult {
  return {
    anomalyId: uuidv4(),
    actions: [
      { type: 'clear_cache', target: 'faculty', params: {}, priority: 10, estimatedRecoveryMs: 100, safe: true },
    ],
    success: true,
    durationMs: 150,
    ...overrides,
  };
}

function createMockLoopAppraisal(overrides: Partial<LoopAppraisal> = {}): LoopAppraisal {
  return {
    overallScore: 0.85,
    dimensions: [
      { dimension: 'effectiveness', score: 0.9, confidence: 0.8, evidence: [], trend: 'stable' },
      { dimension: 'coherence', score: 0.8, confidence: 0.7, evidence: [], trend: 'improving' },
      { dimension: 'safety', score: 0.85, confidence: 0.9, evidence: [], trend: 'stable' },
    ],
    timestamp: Date.now(),
    iteration: 10,
    summary: 'All actions succeeded',
    recommendations: [],
    ...overrides,
  };
}

// ============================================================================
// Selection Schemas
// ============================================================================

describe('Selection Schemas', () => {
  it('validates SelectionEvidenceSchema', () => {
    const evidence = { source: 'faculty', description: 'test', strength: 0.8 };
    const result = SelectionEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(true);
  });

  it('rejects invalid SelectionEvidenceSchema', () => {
    const evidence = { source: 'invalid', description: 'test', strength: 0.8 };
    const result = SelectionEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
  });

  it('validates SelectionCandidateSchema', () => {
    const candidate = createMockSelectionCandidate();
    const result = SelectionCandidateSchema.safeParse(candidate);
    expect(result.success).toBe(true);
  });

  it('validates ScoredCandidateSchema', () => {
    const candidate = createMockSelectionCandidate();
    const scored = { candidate, score: 0.85, rank: 0 };
    const result = ScoredCandidateSchema.safeParse(scored);
    expect(result.success).toBe(true);
  });

  it('validates SelectionMetadataSchema', () => {
    const metadata = {
      candidatesConsidered: 5,
      durationMs: 10,
      explored: false,
      explorationParam: 0.1,
    };
    const result = SelectionMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates SelectionResultSchema', () => {
    const result = createMockSelectionResult();
    const parsed = SelectionResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('validates SelectionResultSchema with null selected', () => {
    const result = createMockSelectionResult({ selected: null });
    const parsed = SelectionResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('validates SelectionContextSchema', () => {
    const candidate = createMockSelectionCandidate();
    const context = {
      candidates: [candidate],
      beliefs: [mockTaskRef],
      goals: [mockTaskRef],
      budget: 100,
      urgency: 0.5,
      riskTolerance: 0.5,
      iteration: 10,
      history: [],
      metadata: {},
    };
    const result = SelectionContextSchema.safeParse(context);
    expect(result.success).toBe(true);
  });

  it('validates SelectionStrategySchema', () => {
    expect(SelectionStrategySchema.safeParse('utility').success).toBe(true);
    expect(SelectionStrategySchema.safeParse('voi').success).toBe(true);
    expect(SelectionStrategySchema.safeParse('epsilon_greedy').success).toBe(true);
    expect(SelectionStrategySchema.safeParse('invalid').success).toBe(false);
  });
});

// ============================================================================
// Action Schemas
// ============================================================================

describe('Action Schemas', () => {
  it('validates EffectResultSchema', () => {
    const effect = {
      type: 'belief_update',
      term: mockTermRef,
      success: true,
      newTruth: mockTruthRef,
    };
    const result = EffectResultSchema.safeParse(effect);
    expect(result.success).toBe(true);
  });

  it('validates ActionResultSchema', () => {
    const action = createMockActionResult();
    const result = ActionResultSchema.safeParse(action);
    expect(result.success).toBe(true);
  });

  it('validates ActionResultSchema with error', () => {
    const action = createMockActionResult({ success: false, error: 'Failed to execute' });
    const result = ActionResultSchema.safeParse(action);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Judgment Schemas
// ============================================================================

describe('Judgment Schemas', () => {
  it('validates JudgmentResultSchema', () => {
    const judgment = createMockJudgmentResult();
    const result = JudgmentResultSchema.safeParse(judgment);
    expect(result.success).toBe(true);
  });

  it('rejects out-of-range score', () => {
    const judgment = createMockJudgmentResult({ score: 1.5 });
    const result = JudgmentResultSchema.safeParse(judgment);
    expect(result.success).toBe(false);
  });

  it('rejects out-of-range confidence', () => {
    const judgment = createMockJudgmentResult({ confidence: -0.1 });
    const result = JudgmentResultSchema.safeParse(judgment);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Contract Schemas
// ============================================================================

describe('Contract Schemas', () => {
  it('validates ContractCheckResultSchema', () => {
    const contract = createMockContractCheckResult();
    const result = ContractCheckResultSchema.safeParse(contract);
    expect(result.success).toBe(true);
  });

  it('validates ContractCheckResultSchema with failure', () => {
    const contract = createMockContractCheckResult({
      passed: false,
      severity: 'critical',
      message: 'Budget exhausted',
      actual: -5,
      expected: '> 0',
    });
    const result = ContractCheckResultSchema.safeParse(contract);
    expect(result.success).toBe(true);
  });

  it('validates IterContractTypeSchema', () => {
    expect(IterContractTypeSchema.safeParse('safety').success).toBe(true);
    expect(IterContractTypeSchema.safeParse('liveness').success).toBe(true);
    expect(IterContractTypeSchema.safeParse('resource').success).toBe(true);
    expect(IterContractTypeSchema.safeParse('invalid').success).toBe(false);
  });

  it('validates IterContractSeveritySchema', () => {
    expect(IterContractSeveritySchema.safeParse('warning').success).toBe(true);
    expect(IterContractSeveritySchema.safeParse('error').success).toBe(true);
    expect(IterContractSeveritySchema.safeParse('critical').success).toBe(true);
    expect(IterContractSeveritySchema.safeParse('invalid').success).toBe(false);
  });

  it('validates LoopContractSchema', () => {
    const contract = {
      id: uuidv4(),
      name: 'Test Contract',
      type: 'safety' as const,
      severity: 'error' as const,
      description: 'Test contract',
      tags: ['test'],
      enabled: true,
    };
    const result = LoopContractSchema.safeParse(contract);
    expect(result.success).toBe(true);
  });

  it('validates ContractContextSchema', () => {
    const context = {
      iteration: 10,
      currentTask: mockTaskRef,
      focusBag: [mockTaskRef],
      beliefs: [mockTaskRef],
      goals: [mockTaskRef],
      previousResults: [],
      resources: {
        tokensUsed: 100,
        tokensRemaining: 900,
        wallTimeMs: 5000,
        cpuTimeMs: 1000,
      },
      oracleCalls: [],
      clock: { now: () => Date.now() },
    };
    const result = ContractContextSchema.safeParse(context);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Repair Schemas
// ============================================================================

describe('Repair Schemas', () => {
  it('validates RepairActionSchema', () => {
    const action = {
      type: 'clear_cache',
      target: 'faculty',
      params: {},
      priority: 10,
      estimatedRecoveryMs: 100,
      safe: true,
    };
    const result = RepairActionSchema.safeParse(action);
    expect(result.success).toBe(true);
  });

  it('validates AnomalySchema', () => {
    const anomaly = {
      type: 'stall',
      severity: 'high',
      description: 'Loop stalled for 100 iterations',
      detectedAt: Date.now(),
      context: {
        iteration: 100,
        recentTasks: [],
        beliefs: [],
        goals: [],
        resources: { cpu: 0.1, memory: 1e6, tokensUsed: 100, tokensRemaining: 900, wallTimeMs: 5000 },
        oracleHealth: [],
        gateStates: [],
      },
      suggestedRepairs: [],
      id: uuidv4(),
    };
    const result = AnomalySchema.safeParse(anomaly);
    expect(result.success).toBe(true);
  });

  it('validates RepairContextSchema', () => {
    const context = {
      iteration: 100,
      recentTasks: [],
      beliefs: [],
      goals: [],
      resources: { cpu: 0.1, memory: 1e6, tokensUsed: 100, tokensRemaining: 900, wallTimeMs: 5000 },
      oracleHealth: [],
      gateStates: [],
      clock: { now: () => Date.now() },
    };
    const result = RepairContextSchema.safeParse(context);
    expect(result.success).toBe(true);
  });

  it('validates RepairResultSchema', () => {
    const result = createMockRepairResult();
    const parsed = RepairResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('validates RepairPolicySchema', () => {
    const policy = {
      anomalyType: 'stall',
      minSeverity: 'medium',
      actions: [
        { type: 'clear_cache', target: 'faculty', params: {}, priority: 10, estimatedRecoveryMs: 100, safe: true },
      ],
      maxRetries: 3,
      cooldownMs: 30000,
    };
    const result = RepairPolicySchema.safeParse(policy);
    expect(result.success).toBe(true);
  });

  it('validates AnomalyTypeSchema', () => {
    expect(AnomalyTypeSchema.safeParse('stall').success).toBe(true);
    expect(AnomalyTypeSchema.safeParse('divergence').success).toBe(true);
    expect(AnomalyTypeSchema.safeParse('invalid').success).toBe(false);
  });

  it('validates AnomalySeveritySchema', () => {
    expect(AnomalySeveritySchema.safeParse('low').success).toBe(true);
    expect(AnomalySeveritySchema.safeParse('critical').success).toBe(true);
    expect(AnomalySeveritySchema.safeParse('invalid').success).toBe(false);
  });

  it('validates RepairActionTypeSchema', () => {
    expect(RepairActionTypeSchema.safeParse('clear_cache').success).toBe(true);
    expect(RepairActionTypeSchema.safeParse('replan').success).toBe(true);
    expect(RepairActionTypeSchema.safeParse('invalid').success).toBe(false);
  });
});

// ============================================================================
// Appraisal Schemas
// ============================================================================

describe('Appraisal Schemas', () => {
  it('validates AppraisalEvidenceSchema', () => {
    const evidence = {
      source: 'metric',
      description: 'Action success rate',
      value: 0.95,
      weight: 0.8,
    };
    const result = AppraisalEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(true);
  });

  it('validates DimensionAppraisalSchema', () => {
    const appraisal = {
      dimension: 'effectiveness',
      score: 0.9,
      confidence: 0.8,
      evidence: [],
      trend: 'stable',
    };
    const result = DimensionAppraisalSchema.safeParse(appraisal);
    expect(result.success).toBe(true);
  });

  it('validates LoopAppraisalSchema', () => {
    const appraisal = createMockLoopAppraisal();
    const result = LoopAppraisalSchema.safeParse(appraisal);
    expect(result.success).toBe(true);
  });

  it('validates AppraisalConfigSchema', () => {
    const config = {
      weights: {
        efficiency: 0.2,
        effectiveness: 0.3,
        coherence: 0.2,
        adaptability: 0.1,
        safety: 0.1,
        progress: 0.1,
      },
      minEvidence: 3,
      historyWindow: 100,
      detailed: true,
    };
    const result = AppraisalConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('validates AppraisalMetricsSchema', () => {
    const metrics = {
      tokensPerIteration: 100,
      timePerIteration: 50,
      oracleCallsPerIteration: 2,
      oracleSuccessRate: 0.95,
      contractViolationRate: 0.01,
      beliefGrowthRate: 0.1,
      goalAchievementRate: 0.8,
      contradictionRate: 0.05,
      uniqueTasksRatio: 0.7,
      fallbackUsageRate: 0.1,
    };
    const result = AppraisalMetricsSchema.safeParse(metrics);
    expect(result.success).toBe(true);
  });

  it('validates AppraisalDimensionSchema', () => {
    expect(AppraisalDimensionSchema.safeParse('effectiveness').success).toBe(true);
    expect(AppraisalDimensionSchema.safeParse('safety').success).toBe(true);
    expect(AppraisalDimensionSchema.safeParse('invalid').success).toBe(false);
  });

  it('validates EvidenceSourceSchema', () => {
    expect(EvidenceSourceSchema.safeParse('metric').success).toBe(true);
    expect(EvidenceSourceSchema.safeParse('contract').success).toBe(true);
    expect(EvidenceSourceSchema.safeParse('invalid').success).toBe(false);
  });

  it('validates TrendSchema', () => {
    expect(TrendSchema.safeParse('improving').success).toBe(true);
    expect(TrendSchema.safeParse('stable').success).toBe(true);
    expect(TrendSchema.safeParse('declining').success).toBe(true);
    expect(TrendSchema.safeParse('invalid').success).toBe(false);
  });
});

// ============================================================================
// Registry and Validation Functions
// ============================================================================

describe('Registry and Validation Functions', () => {
  it('has all iteration artifact schemas registered', () => {
    const expectedTypes = [
      'SelectionResult',
      'SelectionCandidate',
      'SelectionContext',
      'ActionResult',
      'EffectResult',
      'JudgmentResult',
      'ContractCheckResult',
      'ContractContext',
      'LoopContract',
      'RepairResult',
      'Anomaly',
      'RepairContext',
      'RepairAction',
      'RepairPolicy',
      'LoopAppraisal',
      'DimensionAppraisal',
      'AppraisalEvidence',
      'AppraisalConfig',
      'AppraisalMetrics',
    ];
    for (const type of expectedTypes) {
      expect(type in ITERATION_ARTIFACT_SCHEMAS).toBe(true);
    }
  });

  it('getIterationArtifactSchema returns correct schema', () => {
    const schema = getIterationArtifactSchema('SelectionResult');
    expect(schema).toBe(SelectionResultSchema);
  });

  it('validateIterationArtifact validates correctly', () => {
    const candidate = createMockSelectionCandidate();
    const result = validateIterationArtifact('SelectionCandidate', candidate);
    expect(result).toEqual(candidate);
  });

  it('validateIterationArtifact throws on invalid', () => {
    expect(() => validateIterationArtifact('SelectionCandidate', { invalid: true })).toThrow();
  });

  it('safeValidateIterationArtifact returns success object', () => {
    const candidate = createMockSelectionCandidate();
    const result = safeValidateIterationArtifact('SelectionCandidate', candidate);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(candidate);
  });

  it('safeValidateIterationArtifact returns error object', () => {
    const result = safeValidateIterationArtifact('SelectionCandidate', { invalid: true });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeInstanceOf(Error);
  });

  it('validateIterationResult validates full iteration', () => {
    const iterationData = {
      selection: createMockSelectionResult(),
      actions: [createMockActionResult()],
      judgments: [createMockJudgmentResult()],
      contracts: [createMockContractCheckResult()],
      repairs: [createMockRepairResult()],
      appraisal: createMockLoopAppraisal(),
    };
    const result = validateIterationResult(iterationData);
    expect(result.success).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('validateIterationResult catches errors', () => {
    const iterationData = {
      selection: createMockSelectionResult(),
      actions: [{ invalid: true }], // Invalid action
      judgments: [createMockJudgmentResult()],
      contracts: [createMockContractCheckResult()],
      repairs: [createMockRepairResult()],
      appraisal: createMockLoopAppraisal(),
    };
    const result = validateIterationResult(iterationData);
    expect(result.success).toBe(false);
    expect('actions[0]' in result.errors).toBe(true);
  });

  it('validateIterationResult handles partial data', () => {
    const iterationData = {
      selection: createMockSelectionResult(),
    };
    const result = validateIterationResult(iterationData);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// AnyIterationArtifactSchema
// ============================================================================

describe('AnyIterationArtifactSchema', () => {
  it('validates SelectionResult', () => {
    const result = createMockSelectionResult();
    const parsed = AnyIterationArtifactSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('validates ActionResult', () => {
    const result = createMockActionResult();
    const parsed = AnyIterationArtifactSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('validates JudgmentResult', () => {
    const result = createMockJudgmentResult();
    const parsed = AnyIterationArtifactSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('validates ContractCheckResult', () => {
    const result = createMockContractCheckResult();
    const parsed = AnyIterationArtifactSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('validates RepairResult', () => {
    const result = createMockRepairResult();
    const parsed = AnyIterationArtifactSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('validates LoopAppraisal', () => {
    const result = createMockLoopAppraisal();
    const parsed = AnyIterationArtifactSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });
});