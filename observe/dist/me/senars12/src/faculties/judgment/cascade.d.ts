/**
 * Judgment Cascade — the System One judgment pipeline.
 *
 * A staged pipeline with hard floor:
 *   1. Symbolic veto (never learned) — hard rules that cannot be overridden
 *   2. Evidence support — symbolic evidence from NAL/faculties
 *   3. LM rubric judge (async, cached) — learned rubric evaluation
 *   4. Learned logistic judge — calibrated learned model
 *
 * Every weight change is an event with before/after and triggering episodes;
 * per-judge ECE; drifting judge auto-demoted with an event; learned calibration
 * replaces hardcoded Platt constants.
 */
import type { Term } from '../../kernel/terms';
import type { Task } from '../../kernel/types';
import type { Clock, IDGenerator } from '../../kernel/env';
import { type CalibrationManager } from './calibration';
import { type TelemetryCollector } from './telemetry';
import type { IsotonicCalibrator } from '../../lm/system-one/calibration';
import type { JudgmentDataset } from '../../lm/system-one/distill';
import { type LMOracleService } from '../../oracles/lm';
import { OraclePinStore } from '../../oracles/pins';
/** Judgment stages (hard floor cascade). */
export declare const JUDGMENT_STAGES: readonly ['candidates', 'symbolic_veto', 'evidence_support', 'lm_rubric', 'learned_judge', 'calibrate'];
export type JudgmentStage = (typeof JUDGMENT_STAGES)[number];
/** Judgment candidate. */
export interface JudgmentCandidate {
    id: string;
    proposal: Term | Task | string;
    sourceFaculty: string;
    confidence: number;
    evidence: JudgmentEvidence[];
    stageReached: JudgmentStage;
    metadata?: Record<string, unknown>;
    /** Symbolic veto flags. */
    vetoed?: boolean;
    vetoReason?: string;
    /** Evidence support score. */
    evidenceSupport?: number;
    /** LM rubric scores. */
    rubricScores?: Record<string, number>;
    rubricOverall?: number;
    /** Learned judge score. */
    learnedScore?: number;
}
/** Judgment evidence. */
export interface JudgmentEvidence {
    source: 'faculty' | 'oracle' | 'memory' | 'rule' | 'observation' | 'symbolic' | 'rubric' | 'learned';
    description: string;
    strength: number;
    producer?: string;
    oracleCallId?: string;
}
/** Judgment context. */
export interface JudgmentContext {
    situation: Term | Task | string;
    goals: Task[];
    beliefs: Task[];
    budget: number;
    urgency: number;
    riskTolerance: number;
    metadata?: Record<string, unknown>;
    /** Rubric criteria for LM judge. */
    rubricCriteria?: Array<{
        name: string;
        description: string;
        weight: number;
    }>;
    /** Calibration version. */
    calibrationVersion?: string;
}
/** Judgment result. */
export interface JudgmentResult {
    selected: JudgmentCandidate | null;
    candidates: JudgmentCandidate[];
    confidence: number;
    calibration: JudgmentCalibration;
    timings: Record<JudgmentStage, number>;
    fallbackUsed: boolean;
    /** Stage that produced the final decision. */
    decisionStage: JudgmentStage;
}
/** Judgment calibration. */
export interface JudgmentCalibration {
    applied: boolean;
    factor: number;
    preConfidence: number;
    postConfidence: number;
    method: 'isotonic' | 'platt' | 'temperature' | 'beta' | 'none';
    /** Per-judge ECE. */
    judgeECE?: Record<string, {
        ece: number;
        samples: number;
    } | number>;
    /** Whether judge was demoted. */
    judgeDemoted?: boolean;
}
/** Symbolic veto rule. */
export interface VetoRule {
    name: string;
    check: (candidate: JudgmentCandidate, context: JudgmentContext) => {
        vetoed: boolean;
        reason: string;
    };
    priority: number;
}
/** Judgment cascade configuration. */
export interface JudgmentCascadeConfig {
    maxCandidates?: number;
    filterThreshold?: number;
    enableCalibration?: boolean;
    calibrationMethod?: 'isotonic' | 'platt' | 'temperature' | 'beta' | 'none';
    stageTimeoutMs?: number;
    fallbackJudgment?: JudgmentCandidate;
    /** Symbolic veto rules (never learned). */
    vetoRules?: VetoRule[];
    /** LM oracle service for rubric judge. */
    lmService?: LMOracleService;
    /** LM oracle pin store for replay. */
    lmPinStore?: OraclePinStore;
    /** Distillation dataset for label recording. */
    distillationDataset?: JudgmentDataset;
    /** Calibrators for learned judge. */
    calibrators?: Map<string, IsotonicCalibrator>;
    /** Drift demotion config. */
    driftDemotion?: {
        eceThreshold: number;
        consecutiveCycles: number;
        cooldownCycles: number;
    };
}
/** Default configuration. */
export declare const defaultJudgmentCascadeConfig: JudgmentCascadeConfig;
/** Judgment cascade with hard floor. */
export declare class JudgmentCascade {
    private config;
    private stages;
    private stats;
    private readonly clock;
    private readonly ids;
    private readonly calibrationManager;
    private readonly telemetry?;
    private lmRubricOracle;
    private learnedJudge;
    private calibrators;
    private distillationDataset?;
    /** Per-judge ECE tracking. */
    private judgeECE;
    private judgeDriftCycles;
    private judgeDemoted;
    private lastDemotionCycle;
    private cycleNumber;
    constructor(config?: JudgmentCascadeConfig, options?: {
        clock?: Clock;
        ids?: IDGenerator;
        calibrationManager?: CalibrationManager;
        telemetry?: TelemetryCollector;
    });
    /** Register default cascade stages (hard floor). */
    private registerDefaultStages;
    /** Register a custom stage function. */
    registerStage(stage: JudgmentStage, fn: StageFunction): void;
    /** Run the full judgment cascade. */
    judge(context: JudgmentContext): Promise<JudgmentResult>;
    /** Stage 1: Generate candidates using faculties. */
    private generateCandidates;
    /** Extract candidates from faculty output. */
    private extractCandidates;
    /** Stage 2: Symbolic veto (never learned) — hard rules that cannot be overridden. */
    private symbolicVeto;
    /** Stage 3: Evidence support — symbolic evidence from NAL/faculties. */
    private evidenceSupport;
    /** Stage 4: LM rubric judge (async, cached). */
    private lmRubricJudge;
    /** Build prompt for rubric evaluation. */
    private buildRubricPrompt;
    /** Build Zod schema for rubric evaluation. */
    private buildRubricSchema;
    /** Ensure learned judge is initialized. */
    private ensureLearnedJudge;
    /** Stage 5: Learned logistic judge. */
    private learnedJudgeStage;
    /** Stage 6: Calibration. */
    private calibrateStage;
    /** Check judge drift and demote if needed. */
    private checkJudgeDrift;
    private updateJudgeECE;
    /** Check if proposal aligns with goal. */
    private alignsWith;
    /** Check if belief supports proposal. */
    private supports;
    /** Record judgment outcome for calibration. */
    recordOutcome(confidence: number, correct: boolean): Promise<void>;
    /** Train learned judge on new examples. */
    trainLearnedJudge(examples: Array<{
        candidate: JudgmentCandidate;
        context: JudgmentContext;
        correct: boolean;
        outcomeScore: number;
    }>): Promise<void>;
    /** Timeout wrapper. */
    private withTimeout;
    /** Get cascade statistics. */
    getStats(): {
        totalJudgments: number;
        fallbackJudgments: number;
        avgCandidates: number;
        avgDurationMs: number;
        vetoedCount: number;
        lmRubricCalls: number;
        learnedJudgeCalls: number;
        judgeDemotions: number;
        byStage: Record<"calibrate" | "candidates" | "evidence_support" | "learned_judge" | "lm_rubric" | "symbolic_veto", {
            calls: number;
            avgDurationMs: number;
        }>;
        judgeECE: Record<string, {
            ece: number;
            samples: number;
        }>;
        judgeDriftCycles: Record<string, number>;
        judgeDemoted: Record<string, boolean>;
        calibrationDataPoints: number;
    };
}
/** Stage function type. */
export type StageFunction = (candidates: JudgmentCandidate[], context: JudgmentContext) => Promise<JudgmentCandidate[]>;
/** Create a judgment cascade. */
export declare function createJudgmentCascade(config?: JudgmentCascadeConfig, options?: {
    clock?: Clock;
    ids?: IDGenerator;
    calibrationManager?: CalibrationManager;
    telemetry?: TelemetryCollector;
}): JudgmentCascade;
/** Global judgment cascade instance (non-deterministic; prefer {@link createJudgmentCascade}). */
export declare const judgmentCascade: JudgmentCascade;
/** Convenience function to run judgment. */
export declare function judge(context: JudgmentContext): Promise<JudgmentResult>;
//# sourceMappingURL=cascade.d.ts.map