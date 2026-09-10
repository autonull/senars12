/**
 * Kernel Schemas — Operational Invariants Boundary
 * Zod schemas for event-sourced state, budget accounting, derivation verification, and NL formalization.
 * These schemas define the trusted kernel's validation layer at untrusted boundaries.
 */

import {z} from 'zod';

/**
 * ============================================================================
 * COGNITIVE EVENT LOG SCHEMAS
 * Append-only event log is the source of truth for cognitive state.
 * All state mutations must pass through event admission gates.
 * ============================================================================
 */

export const EngineOriginSchema = z.enum(['nar', 'metta', 'kernel', 'proposer']);

export const CognitiveEventBaseSchema = z.object({
    engine: EngineOriginSchema,
    timestamp: z.number().int().positive(),
    correlationId: z.string(),
    causationId: z.string().optional(),
    id: z.string().uuid().optional(),
});

export const TaskAdmittedEventSchema = CognitiveEventBaseSchema.extend({
    type: z.literal('task.admitted'),
    payload: z.object({
        taskId: z.string().uuid(),
        term: z.string(),
        taskType: z.enum(['belief', 'goal', 'question', 'command']),
        truth: z.object({
            frequency: z.number().min(0).max(1),
            confidence: z.number().min(0).max(1),
        }).optional(),
        source: z.enum(['user', 'llm', 'derivation', 'reflex', 'sensor']),
        budget: z.object({
            priority: z.number().min(0).max(1),
            durability: z.number().min(0).max(1),
            quality: z.number().min(0).max(1),
            cycles: z.number().int().nonnegative(),
            depth: z.number().int().nonnegative(),
        }),
    }),
});

export const DerivationAcceptedEventSchema = CognitiveEventBaseSchema.extend({
    type: z.literal('derivation.accepted'),
    payload: z.object({
        derivationId: z.string().uuid(),
        ruleId: z.string(),
        premises: z.array(z.string()),
        conclusion: z.string(),
        truth: z.object({
            frequency: z.number().min(0).max(1),
            confidence: z.number().min(0).max(1),
        }),
        evidenceLineage: z.array(z.string().uuid()),
        independenceCheck: z.enum(['independent', 'dependent', 'unknown']),
    }),
});

export const BeliefRevisedEventSchema = CognitiveEventBaseSchema.extend({
    type: z.literal('belief.revised'),
    payload: z.object({
        term: z.string(),
        oldTruth: z.object({
            frequency: z.number().min(0).max(1),
            confidence: z.number().min(0).max(1),
        }),
        newTruth: z.object({
            frequency: z.number().min(0).max(1),
            confidence: z.number().min(0).max(1),
        }),
        evidenceLineage: z.array(z.string().uuid()),
        revisionRule: z.string(),
    }),
});

export const ConceptActivatedEventSchema = CognitiveEventBaseSchema.extend({
    type: z.literal('concept.activated'),
    payload: z.object({
        term: z.string(),
        priority: z.number(),
        activationSource: z.enum(['perception', 'goal', 'derivation', 'decay', 'associative']),
    }),
});

export const BudgetExhaustedEventSchema = CognitiveEventBaseSchema.extend({
    type: z.literal('budget.exhausted'),
    payload: z.object({
        budgetType: z.enum(['cycles', 'depth', 'memory', 'llm', 'wallclock']),
        remaining: z.number(),
        limit: z.number(),
        terminationReason: z.enum(['cycle-budget', 'depth-budget', 'memory-budget', 'llm-budget', 'deadline', 'backpressure']),
    }),
});

export const PolicyViolationEventSchema = CognitiveEventBaseSchema.extend({
    type: z.literal('policy.violation'),
    payload: z.object({
        policyId: z.string(),
        violationType: z.enum(['unauthorized-tool', 'budget-exceeded', 'epistemic-firewall', 'sandbox-escape', 'self-mod-unauthorized']),
        detail: z.string(),
        severity: z.enum(['warn', 'block', 'quarantine']),
    }),
});

export const AutonomyModeChangedEventSchema = CognitiveEventBaseSchema.extend({
    type: z.literal('autonomy.mode.changed'),
    payload: z.object({
        previousMode: z.enum(['observe-only', 'propose-only', 'sandbox-execute', 'low-risk-auto-merge', 'human-approved-production']),
        newMode: z.enum(['observe-only', 'propose-only', 'sandbox-execute', 'low-risk-auto-merge', 'human-approved-production']),
        authorizedBy: z.enum(['system', 'human', 'external-governance']),
    }),
});

export const PatchProposalSchema = z.object({
    proposalId: z.string().uuid(),
    patchRef: z.string(),
    baseCommit: z.string(),
    patchDiff: z.string(),
    ciResults: z.object({
        test: z.boolean(),
        typecheck: z.boolean(),
        lint: z.boolean(),
        durationMs: z.number().int().positive(),
    }),
    riskSelfAssessment: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    affectedComponents: z.array(z.enum([
        'approval-logic',
        'sandbox-config',
        'reward-functions',
        'autonomy-mode',
        'kernel-gates',
        'cognitive-params',
        'tools',
        'rules',
        'memory',
        'other',
    ])),
    affectedFiles: z.array(z.string()),
    linesAdded: z.number().int().nonnegative(),
    linesRemoved: z.number().int().nonnegative(),
    coverageDelta: z.number().optional(),
    rationale: z.string(),
    timestamp: z.number().int().positive(),
    agentSignature: z.string(),
    correlationId: z.string().optional(),
});

export const SelfModProposalEventSchema = CognitiveEventBaseSchema.extend({
    type: z.literal('self-mod.proposal'),
    payload: PatchProposalSchema,
});

export const CognitiveEventSchema = z.discriminatedUnion('type', [
    TaskAdmittedEventSchema,
    DerivationAcceptedEventSchema,
    BeliefRevisedEventSchema,
    ConceptActivatedEventSchema,
    BudgetExhaustedEventSchema,
    PolicyViolationEventSchema,
    AutonomyModeChangedEventSchema,
    SelfModProposalEventSchema,
]);

export type CognitiveEvent = z.infer<typeof CognitiveEventSchema>;
export type TaskAdmittedEvent = z.infer<typeof TaskAdmittedEventSchema>;
export type DerivationAcceptedEvent = z.infer<typeof DerivationAcceptedEventSchema>;
export type BeliefRevisedEvent = z.infer<typeof BeliefRevisedEventSchema>;
export type ConceptActivatedEvent = z.infer<typeof ConceptActivatedEventSchema>;
export type BudgetExhaustedEvent = z.infer<typeof BudgetExhaustedEventSchema>;
export type PolicyViolationEvent = z.infer<typeof PolicyViolationEventSchema>;
export type AutonomyModeChangedEvent = z.infer<typeof AutonomyModeChangedEventSchema>;
export type SelfModProposalEvent = z.infer<typeof SelfModProposalEventSchema>;

/**
 * ============================================================================
 * REASONING BUDGET SCHEMAS
 * Explicit budget context passed to all recursive/heavy functions.
 * TerminationReason enums replace generic timeouts.
 * ============================================================================
 */

export const TerminationReasonSchema = z.enum([
    'cycle-budget',
    'depth-budget',
    'memory-budget',
    'llm-budget',
    'deadline',
    'backpressure',
    'aborted',
    'completed',
]);

export const ReasoningBudgetSchema = z.object({
    maxCycles: z.number().int().positive(),
    maxDepth: z.number().int().positive(),
    maxMemoryOps: z.number().int().positive(),
    maxLMCalls: z.number().int().nonnegative(),
    wallclockDeadlineMs: z.number().int().positive().optional(),
    abortSignal: z.unknown().optional(), // AbortSignal - cannot serialize, validated at runtime
    terminationReason: TerminationReasonSchema.optional(),
    consumed: z.object({
        cycles: z.number().int().nonnegative().default(0),
        depth: z.number().int().nonnegative().default(0),
        memoryOps: z.number().int().nonnegative().default(0),
        llmCalls: z.number().int().nonnegative().default(0),
    }).default(() => ({ cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 })),
});

export type ReasoningBudget = z.infer<typeof ReasoningBudgetSchema>;
export type TerminationReason = z.infer<typeof TerminationReasonSchema>;

/**
 * ============================================================================
 * DERIVATION RECORD SCHEMAS
 * Standalone verifier input — minimal, dependency-free derivation proof.
 * Used by the standalone Derivation Verifier script.
 * ============================================================================
 */

export const TruthValueSchema = z.object({
    frequency: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
});

export const DerivationStepSchema = z.object({
    stepId: z.string().uuid(),
    ruleId: z.string(),
    ruleCategory: z.enum(['core', 'logic', 'propositional', 'higher-order', 'comparison', 'classical', 'structural', 'temporal', 'procedural', 'meta-cognitive', 'variable']),
    premises: z.array(z.string()), // Term strings
    conclusion: z.string(), // Term string
    truth: TruthValueSchema,
    substitution: z.record(z.string(), z.string()).optional(), // Variable bindings
    premiseTruths: z.array(TruthValueSchema).optional(), // Truth of each premise, in order — enables standalone truth-algebra verification
    evidenceLineage: z.array(z.string().uuid()), // Parent derivation IDs
    independence: z.enum(['independent', 'dependent', 'unknown']),
});

export const DerivationRecordSchema = z.object({
    derivationId: z.string().uuid(),
    taskId: z.string().uuid(),
    goalTerm: z.string(),
    steps: z.array(DerivationStepSchema),
    finalTruth: TruthValueSchema,
    totalCycles: z.number().int().nonnegative(),
    maxDepthReached: z.number().int().nonnegative(),
    timestamp: z.number().int().positive(),
    engine: z.enum(['nar', 'metta']),
});

export type DerivationRecord = z.infer<typeof DerivationRecordSchema>;
export type DerivationStep = z.infer<typeof DerivationStepSchema>;
export type TruthValue = z.infer<typeof TruthValueSchema>;

/**
 * ============================================================================
 * FORMALIZATION CANDIDATE SCHEMAS
 * LLM returns multiple candidates with ambiguity flags — kernel admits provisionally.
 * No single authoritative parse; kernel validates each candidate.
 * ============================================================================
 */

export const AmbiguityFlagSchema = z.object({
    type: z.enum(['parse', 'intent', 'term', 'reference', 'quantifier', 'modal', 'temporal', 'negation']),
    description: z.string(),
    options: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    severity: z.enum(['low', 'medium', 'high']),
});

export const SourceSpanSchema = z.object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    text: z.string(),
});

export const FormalizationCandidateSchema = z.object({
    candidateId: z.string().uuid(),
    narsese: z.string(),
    taskType: z.enum(['belief', 'goal', 'question']),
    truth: TruthValueSchema.optional(),
    confidence: z.number().min(0).max(1), // LLM's confidence in this parse
    sourceSpans: z.array(SourceSpanSchema),
    ambiguityFlags: z.array(AmbiguityFlagSchema),
    metadata: z.object({
        model: z.string().optional(),
        promptTokens: z.number().int().nonnegative().optional(),
        completionTokens: z.number().int().nonnegative().optional(),
        latencyMs: z.number().int().nonnegative().optional(),
    }).optional(),
});

export const FormalizationBatchSchema = z.object({
    batchId: z.string().uuid(),
    sourceText: z.string(),
    candidates: z.array(FormalizationCandidateSchema),
    detectedIntent: z.enum(['chat', 'command', 'reasoning', 'learning']).optional(),
    globalAmbiguities: z.array(AmbiguityFlagSchema).optional(),
});

export type FormalizationCandidate = z.infer<typeof FormalizationCandidateSchema>;
export type AmbiguityFlag = z.infer<typeof AmbiguityFlagSchema>;
export type SourceSpan = z.infer<typeof SourceSpanSchema>;
export type FormalizationBatch = z.infer<typeof FormalizationBatchSchema>;

/**
 * ============================================================================
 * GATE INPUT/OUTPUT SCHEMAS
 * Gate contracts for PerceptionGate, ActionGate, RewardGate, BudgetGate
 * ============================================================================
 */

export const AutonomyModeSchema = z.enum(['observe-only', 'propose-only', 'sandbox-execute', 'low-risk-auto-merge', 'human-approved-production']);
export type AutonomyMode = z.infer<typeof AutonomyModeSchema>;
export const SourceQualitySchema = z.enum(['PRIMARY', 'SECONDARY', 'GENERAL', 'TERTIARY', 'LLM_PRIOR']);
export type SourceQuality = z.infer<typeof SourceQualitySchema>;
export const GameDomainSchema = z.enum(['external', 'self']);
export type GameDomain = z.infer<typeof GameDomainSchema>;
export const RewardDomainSchema = z.enum(['external-reflex', 'self-scheduler', 'self-config-proposal', 'self-patch-score', 'self-explanation-rank']);
export type RewardDomain = z.infer<typeof RewardDomainSchema>;
export const SelfImprovementProposalSchema = z.object({
    proposalId: z.string().uuid(),
    kind: z.enum(['knob-tune', 'focus-weight', 'strategy-switch', 'schema-promotion', 'patch-apply', 'test-generate']),
    riskTier: z.enum(['low', 'medium', 'high']),
    payload: z.record(z.string(), z.unknown()),
    rewardDomain: RewardDomainSchema,
    correlationId: z.string().optional(),
});
export type SelfImprovementProposal = z.infer<typeof SelfImprovementProposalSchema>;

export type PatchProposal = z.infer<typeof PatchProposalSchema>;

export const RiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const RiskAssessmentSchema = z.object({
    risk: RiskLevelSchema,
    score: z.number().int().nonnegative(),
    factors: z.array(z.object({ factor: z.string(), file: z.string().optional(), component: z.string().optional(), severity: z.enum(['LOW', 'MEDIUM', 'HIGH']) })),
});
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

export const GovernanceDecisionSchema = z.object({
    action: z.enum(['AUTO_MERGE', 'CREATE_PR', 'REQUIRE_HUMAN_REVIEW', 'REJECT']),
    reason: z.string(),
    reviewers: z.number().int().nonnegative().optional(),
});
export type GovernanceDecision = z.infer<typeof GovernanceDecisionSchema>;

export const GovernanceEventSchema = z.object({
    eventId: z.string().uuid(),
    proposalId: z.string().uuid(),
    decision: z.enum(['AUTO_MERGED', 'PR_CREATED', 'HUMAN_REVIEW_REQUIRED', 'REJECTED']),
    riskLevel: RiskLevelSchema,
    autonomyMode: AutonomyModeSchema,
    decidedAt: z.number().int().positive(),
    decidedBy: z.enum(['governance-runner', 'human-reviewer', 'security-team']),
});
export type GovernanceEvent = z.infer<typeof GovernanceEventSchema>;

export const PerceptionGateInputSchema = z.object({
    sourceId: z.string(),
    rawObservation: z.unknown(),
    sensorConfidence: z.number().min(0).max(1),
    sourceQuality: SourceQualitySchema,
    correlationId: z.string().optional(),
});

export const PerceptionGateOutputSchema = z.object({
    admitted: z.boolean(),
    task: TaskAdmittedEventSchema.shape.payload.optional(),
    rejectionReason: z.string().optional(),
});

export const ActionGateInputSchema = z.object({
    proposalId: z.string().uuid(),
    operation: z.string(),
    args: z.record(z.string(), z.unknown()),
    proposerReflexId: z.string().optional(),
    nalDerivationId: z.string().uuid().optional(),
    correlationId: z.string().optional(),
});

export const ActionGateOutputSchema = z.object({
    authorized: z.boolean(),
    toolCallId: z.string().uuid().optional(),
    vetoReason: z.string().optional(), // If NAL derivation vetoes
    requiredApprovals: z.array(z.string()).optional(),
});

export const RewardGateInputSchema = z.object({
    eventId: z.string().uuid(),
    rewardSignal: z.number().min(-1).max(1),
    rewardType: z.enum(['extrinsic', 'intrinsic', 'derivation-depth-reduction', 'self-model-accuracy', 'contradiction-reduction']),
    targetType: z.enum(['attention-priority', 'policy-weights', 'truth-frequency', 'truth-confidence']),
    targetId: z.string(),
    domain: RewardDomainSchema.optional(),
    correlationId: z.string().optional(),
});

export const RewardGateOutputSchema = z.object({
    accepted: z.boolean(),
    mutationApplied: z.boolean().optional(),
    epistemicFirewallViolation: z.boolean().optional(),
    rejectionReason: z.string().optional(),
    requiresProposal: z.boolean().optional(),
});

export const BudgetGateInputSchema = z.object({
    budget: ReasoningBudgetSchema.optional(),
    operation: z.enum(['nal-step', 'lm-call', 'memory-op', 'derivation-depth']),
    estimatedCost: z.number().int().positive().optional(),
    scopeId: z.string().optional(),
    correlationId: z.string().optional(),
});

export const BudgetGateOutputSchema = z.object({
    granted: z.boolean(),
    updatedBudget: ReasoningBudgetSchema.optional(),
    terminationReason: TerminationReasonSchema.optional(),
});

/**
 * ============================================================================
 * VALIDATION HELPERS
 * ============================================================================
 */

export type PerceptionGateInput = z.infer<typeof PerceptionGateInputSchema>;
export type PerceptionGateOutput = z.infer<typeof PerceptionGateOutputSchema>;
export type ActionGateInput = z.infer<typeof ActionGateInputSchema>;
export type ActionGateOutput = z.infer<typeof ActionGateOutputSchema>;
export type RewardGateInput = z.infer<typeof RewardGateInputSchema>;
export type RewardGateOutput = z.infer<typeof RewardGateOutputSchema>;
export type BudgetGateInput = z.infer<typeof BudgetGateInputSchema>;
export type BudgetGateOutput = z.infer<typeof BudgetGateOutputSchema>;

export const validateCognitiveEvent = (event: unknown): CognitiveEvent => {
    const result = CognitiveEventSchema.safeParse(event);
    if (!result.success) {
        throw new Error(`Invalid CognitiveEvent: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    }
    return result.data;
};

export const validateReasoningBudget = (budget: unknown): ReasoningBudget => {
    const result = ReasoningBudgetSchema.safeParse(budget);
    if (!result.success) {
        throw new Error(`Invalid ReasoningBudget: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    }
    return result.data;
};

export const validateDerivationRecord = (record: unknown): DerivationRecord => {
    const result = DerivationRecordSchema.safeParse(record);
    if (!result.success) {
        throw new Error(`Invalid DerivationRecord: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    }
    return result.data;
};

export const validateFormalizationCandidate = (candidate: unknown): FormalizationCandidate => {
    const result = FormalizationCandidateSchema.safeParse(candidate);
    if (!result.success) {
        throw new Error(`Invalid FormalizationCandidate: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    }
    return result.data;
};

export const validateFormalizationBatch = (batch: unknown): FormalizationBatch => {
    const result = FormalizationBatchSchema.safeParse(batch);
    if (!result.success) {
        throw new Error(`Invalid FormalizationBatch: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    }
    return result.data;
};