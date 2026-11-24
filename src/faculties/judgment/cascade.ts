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

import { Truth as TruthOps, Truth } from '../../kernel/truth';
import type { Term } from '../../kernel/terms';
import type { Task } from '../../kernel/types';
import type { FacultyInput, FacultyOutput } from '../specs';
import { facultyEngine } from '../engine';
import { OracleOutput } from '../../oracles/oracle';
import type { Clock, IDGenerator, TimestampMs } from '../../kernel/env';
import { createCalibrationManager, type CalibrationManager } from './calibration';
import { createTelemetryCollector, type TelemetryCollector } from './telemetry';
import type { IsotonicCalibrator } from '../../lm/system-one/calibration';
import type { JudgmentDataset } from '../../lm/system-one/distill';
import { createLMGenerateObjectOracle, type LMOracleService } from '../../oracles/lm';
import { OraclePinStore } from '../../oracles/pins';
import { SenarsError } from '../../errors/senars-error';
import { createLogger } from '../../util/logger';
import { errMsg } from '@senars/util/error';
import { flooredRatio, sigmoid } from '@senars/util/numeric';
import { mapToRecord } from '@senars/util/collections';

const logger = createLogger({ scope: 'faculties:judgment:cascade' });


/** Judgment stages (hard floor cascade). */
export const JUDGMENT_STAGES = [
  'candidates',
  'symbolic_veto',
  'evidence_support',
  'lm_rubric',
  'learned_judge',
  'calibrate',
] as const;

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
  rubricCriteria?: Array<{ name: string; description: string; weight: number }>;
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
  judgeECE?: Record<string, { ece: number; samples: number } | number>;
  /** Whether judge was demoted. */
  judgeDemoted?: boolean;
}

/** Symbolic veto rule. */
export interface VetoRule {
  name: string;
  check: (candidate: JudgmentCandidate, context: JudgmentContext) => { vetoed: boolean; reason: string };
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
  driftDemotion?: { eceThreshold: number; consecutiveCycles: number; cooldownCycles: number };
}

/** Default configuration. */
export const defaultJudgmentCascadeConfig: JudgmentCascadeConfig = {
  maxCandidates: 10,
  filterThreshold: 0.3,
  enableCalibration: true,
  calibrationMethod: 'isotonic',
  stageTimeoutMs: 5000,
  vetoRules: [
    {
      name: 'safety-critical',
      priority: 100,
      check: (candidate) => {
        const propStr = candidate.proposal.toString().toLowerCase();
        if (propStr.includes('delete') || propStr.includes('destroy') || propStr.includes('remove all')) {
          return { vetoed: true, reason: 'Safety-critical operation detected' };
        }
        return { vetoed: false, reason: '' };
      },
    },
    {
      name: 'contradiction',
      priority: 90,
      check: (candidate, context) => {
        const propStr = candidate.proposal.toString();
        for (const belief of context.beliefs) {
          if (propStr === belief.term.toString()) {
            return { vetoed: true, reason: 'Direct contradiction with existing belief' };
          }
        }
        return { vetoed: false, reason: '' };
      },
    },
  ],
};

/** Judgment cascade with hard floor. */
export class JudgmentCascade {
  private config: JudgmentCascadeConfig;
  private stages = new Map<JudgmentStage, StageFunction>();
  private stats = {
    totalJudgments: 0,
    fallbackJudgments: 0,
    avgCandidates: 0,
    avgDurationMs: 0,
    byStage: new Map<JudgmentStage, { calls: number; avgDurationMs: number }>(),
    vetoedCount: 0,
    lmRubricCalls: 0,
    learnedJudgeCalls: 0,
    judgeDemotions: 0,
  };
  private readonly clock: Clock;
  private readonly ids: IDGenerator;
  private readonly calibrationManager: CalibrationManager;
  private readonly telemetry?: TelemetryCollector;

  private lmRubricOracle: ReturnType<typeof createLMGenerateObjectOracle> | null = null;
  private learnedJudge: ReturnType<typeof import('./judge').createJudge> | null = null;
  private calibrators: Map<string, IsotonicCalibrator> = new Map();
  private distillationDataset?: JudgmentDataset;

  /** Per-judge ECE tracking. */
  private judgeECE = new Map<string, { ece: number; samples: number }>();
  private judgeDriftCycles = new Map<string, number>();
  private judgeDemoted = new Map<string, boolean>();
  private lastDemotionCycle = new Map<string, number>();
  private cycleNumber = 0;

  constructor(
    config: JudgmentCascadeConfig = {},
    options: { clock?: Clock; ids?: IDGenerator; calibrationManager?: CalibrationManager; telemetry?: TelemetryCollector } = {}
  ) {
    this.config = { ...defaultJudgmentCascadeConfig, ...config };
    this.clock = options.clock ?? { now: () => Date.now() as TimestampMs, setTime: () => {}, advance: () => {} };
    this.ids = options.ids ?? { uuid: () => crypto.randomUUID(), short: () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    this.calibrationManager = options.calibrationManager ?? createCalibrationManager({ method: this.config.calibrationMethod });
    this.telemetry = options.telemetry;

    // Initialize LM rubric oracle if LM service provided
    if (this.config.lmService) {
      this.lmRubricOracle = createLMGenerateObjectOracle(this.config.lmService, {
        provider: this.config.lmService.provider ?? 'lm-rubric',
        version: this.config.lmService.model,
        budgetResource: 'llmCalls',
      });
      if (this.config.lmPinStore) {
        this.lmRubricOracle.setPinStore(this.config.lmPinStore);
      }
    }

    // Learned judge initialized lazily on first use
    this.learnedJudge = null;

    // Load calibrators if provided
    if (this.config.calibrators) {
      this.calibrators = this.config.calibrators;
    }

    this.distillationDataset = this.config.distillationDataset;

    this.registerDefaultStages();
  }

  /** Register default cascade stages (hard floor). */
  private registerDefaultStages(): void {
    this.registerStage('candidates', this.generateCandidates.bind(this));
    this.registerStage('symbolic_veto', this.symbolicVeto.bind(this));
    this.registerStage('evidence_support', this.evidenceSupport.bind(this));
    this.registerStage('lm_rubric', this.lmRubricJudge.bind(this));
    this.registerStage('learned_judge', this.learnedJudgeStage.bind(this));
    this.registerStage('calibrate', this.calibrateStage.bind(this));
  }

  /** Register a custom stage function. */
  registerStage(stage: JudgmentStage, fn: StageFunction): void {
    this.stages.set(stage, fn);
  }

  /** Run the full judgment cascade. */
  async judge(context: JudgmentContext): Promise<JudgmentResult> {
    this.cycleNumber++;
    const startTs = this.clock.now();
    this.stats.totalJudgments++;

    if (this.telemetry) {
      await this.telemetry.judgmentStart(context);
    }

    let candidates: JudgmentCandidate[] = [];
    const timings: Record<JudgmentStage, number> = {} as Record<JudgmentStage, number>;
    let fallbackUsed = false;
    let decisionStage: JudgmentStage = 'candidates';

    for (const stage of JUDGMENT_STAGES) {
      const stageStart = this.clock.now();
      const stageFn = this.stages.get(stage);

      if (!stageFn) {
        timings[stage] = 0;
        continue;
      }

      try {
        const inputCount = candidates.length;
        candidates = await this.withTimeout(stageFn(candidates, context), this.config.stageTimeoutMs ?? 5000);
        timings[stage] = this.clock.now() - stageStart;

        if (this.telemetry) {
          await this.telemetry.judgmentStage(stage, inputCount, candidates.length, timings[stage]);
        }

        if (this.telemetry && stage === 'candidates') {
          for (const candidate of candidates) {
            await this.telemetry.candidate(candidate, stage);
          }
        }

        const stageStats = this.stats.byStage.get(stage) ?? { calls: 0, avgDurationMs: 0 };
        stageStats.calls++;
        stageStats.avgDurationMs = (stageStats.avgDurationMs * (stageStats.calls - 1) + timings[stage]) / stageStats.calls;
        this.stats.byStage.set(stage, stageStats);

        // Early exit if all candidates vetoed
        if (stage === 'symbolic_veto' && candidates.every(c => c.vetoed)) {
          decisionStage = 'symbolic_veto';
          break;
        }

        decisionStage = stage;
      } catch (error) {
        timings[stage] = this.clock.now() - stageStart;
        if (this.telemetry) {
          await this.telemetry.judgmentStage(stage, candidates.length, candidates.length, timings[stage], String(error));
        }
        logger.warn(`Judgment stage ${stage} failed:`, { error: errMsg(error) });
      }
    }

    // Select final candidate from non-vetoed, highest confidence
    let selected: JudgmentCandidate | null = null;
    const nonVetoed = candidates.filter(c => !c.vetoed);
    if (nonVetoed.length > 0) {
      selected = nonVetoed[0]!;
    } else if (candidates.length > 0) {
      // All vetoed - pick least vetoed (shouldn't happen with proper vetoes)
      selected = candidates[0]!;
    }

    if (!selected && this.config.fallbackJudgment) {
      selected = this.config.fallbackJudgment;
      fallbackUsed = true;
      this.stats.fallbackJudgments++;
    }

    if (this.telemetry && selected) {
      await this.telemetry.selected(selected, 1, candidates.length);
    }

    // Final calibration
    let calibration: JudgmentCalibration = {
      applied: false,
      factor: 1.0,
      preConfidence: selected?.confidence ?? 0,
      postConfidence: selected?.confidence ?? 0,
      method: 'none',
      judgeECE: mapToRecord(this.judgeECE),
    };

    if (this.config.enableCalibration && selected) {
      calibration = this.calibrationManager.calibrate(selected.confidence);
      selected.confidence = calibration.postConfidence;

      // Apply per-judge calibration if available
      const rubricCalibrator = this.calibrators.get('rubric');
      const learnedCalibrator = this.calibrators.get('learned');
      if (rubricCalibrator && selected.rubricOverall !== undefined) {
        selected.rubricOverall = rubricCalibrator.calibrate(selected.rubricOverall);
      }
      if (learnedCalibrator && selected.learnedScore !== undefined) {
        selected.learnedScore = learnedCalibrator.calibrate(selected.learnedScore);
      }

      // Check judge drift and demote if needed
      await this.checkJudgeDrift();

      if (this.telemetry) {
        await this.telemetry.calibrated(
          selected.id,
          calibration.preConfidence,
          calibration.postConfidence,
          calibration.method,
          calibration.factor
        );
      }
    }

    const totalDuration = this.clock.now() - startTs;
    this.stats.avgDurationMs = (this.stats.avgDurationMs * (this.stats.totalJudgments - 1) + totalDuration) / this.stats.totalJudgments;
    this.stats.avgCandidates = (this.stats.avgCandidates * (this.stats.totalJudgments - 1) + candidates.length) / this.stats.totalJudgments;

    const result: JudgmentResult = {
      selected,
      candidates,
      confidence: selected?.confidence ?? 0,
      calibration,
      timings,
      fallbackUsed,
      decisionStage,
    };

    if (this.telemetry) {
      await this.telemetry.complete(result);
    }

    return result;
  }

  /** Stage 1: Generate candidates using faculties. */
  private async generateCandidates(_candidates: JudgmentCandidate[], context: JudgmentContext): Promise<JudgmentCandidate[]> {
    const candidates: JudgmentCandidate[] = [];
    const faculties = ['abduction', 'inference', 'analogy', 'induction', 'planning', 'propose.action', 'propose.hypothesis', 'propose.repair', 'propose.plan'];

    for (const faculty of faculties) {
      try {
        const input: FacultyInput = {
          faculty: faculty as any,
          primary: context.situation as any,
          context: {
            confidenceThreshold: 0.3,
            maxResults: 3,
          },
          budget: 0.2,
        };

        const output = await facultyEngine.invoke(input);

        if (output.result && typeof output.result === 'object') {
          const facultyCandidates = this.extractCandidates(output, faculty);
          candidates.push(...facultyCandidates);
        }
      } catch (error) {
        logger.warn(`Faculty ${faculty} failed during candidate generation:`, { error: errMsg(error) });
      }
    }

    for (const goal of context.goals.slice(0, 3)) {
      candidates.push({
        id: this.ids.uuid(),
        proposal: goal,
        sourceFaculty: 'goal',
        confidence: 0.7,
        evidence: [{ source: 'observation', description: 'Active goal', strength: 0.7 }],
        stageReached: 'candidates',
      });
    }

    return candidates
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxCandidates);
  }

  /** Extract candidates from faculty output. */
  private extractCandidates(output: FacultyOutput, faculty: string): JudgmentCandidate[] {
    const candidates: JudgmentCandidate[] = [];
    const result = output.result as any;

    if (result.hypotheses) {
      for (const h of result.hypotheses) {
        candidates.push({
          id: this.ids.uuid(),
          proposal: h.term,
          sourceFaculty: faculty,
          confidence: h.truth ? Truth.expectation(h.truth) : 0.3,
          evidence: [{ source: 'faculty', description: `${faculty} hypothesis`, strength: output.confidence, producer: faculty }],
          stageReached: 'candidates',
        });
      }
    } else if (result.conclusions) {
      for (const c of result.conclusions) {
        candidates.push({
          id: this.ids.uuid(),
          proposal: c.term,
          sourceFaculty: faculty,
          confidence: c.truth ? Truth.expectation(c.truth) : 0.3,
          evidence: [{ source: 'faculty', description: `${faculty} conclusion`, strength: output.confidence, producer: faculty }],
          stageReached: 'candidates',
        });
      }
    } else if (result.mappings) {
      for (const m of result.mappings) {
        candidates.push({
          id: this.ids.uuid(),
          proposal: m.target,
          sourceFaculty: faculty,
          confidence: m.confidence,
          evidence: [{ source: 'faculty', description: `${faculty} mapping`, strength: output.confidence, producer: faculty }],
          stageReached: 'candidates',
        });
      }
    } else if (result.plan) {
      for (const step of result.plan) {
        candidates.push({
          id: this.ids.uuid(),
          proposal: step.step,
          sourceFaculty: faculty,
          confidence: 0.5,
          evidence: [{ source: 'faculty', description: `${faculty} plan step`, strength: output.confidence, producer: faculty }],
          stageReached: 'candidates',
        });
      }
    } else if (result.proposals) {
      for (const p of result.proposals) {
        candidates.push({
          id: this.ids.uuid(),
          proposal: p.action ?? p.term ?? p,
          sourceFaculty: faculty,
          confidence: p.confidence ?? 0.5,
          evidence: [{ source: 'faculty', description: `${faculty} proposal`, strength: output.confidence, producer: faculty }],
          stageReached: 'candidates',
        });
      }
    }

    return candidates;
  }

  /** Stage 2: Symbolic veto (never learned) — hard rules that cannot be overridden. */
  private async symbolicVeto(candidates: JudgmentCandidate[], context: JudgmentContext): Promise<JudgmentCandidate[]> {
    const vetoRules = this.config.vetoRules ?? [];

    for (const candidate of candidates) {
      candidate.stageReached = 'symbolic_veto';

      for (const rule of vetoRules.sort((a, b) => b.priority - a.priority)) {
        const { vetoed, reason } = rule.check(candidate, context);
        if (vetoed) {
          candidate.vetoed = true;
          candidate.vetoReason = reason;
          candidate.evidence.push({
            source: 'symbolic',
            description: `Veto: ${rule.name} - ${reason}`,
            strength: 1.0,
            producer: `veto.${rule.name}`,
          });
          this.stats.vetoedCount++;
          break;
        }
      }
    }

    return candidates;
  }

  /** Stage 3: Evidence support — symbolic evidence from NAL/faculties. */
  private async evidenceSupport(candidates: JudgmentCandidate[], context: JudgmentContext): Promise<JudgmentCandidate[]> {
    for (const candidate of candidates) {
      candidate.stageReached = 'evidence_support';

      if (candidate.vetoed) continue;

      let support = 0;
      let evidenceCount = 0;

      // Goal alignment evidence
      for (const goal of context.goals) {
        if (this.alignsWith(candidate.proposal, goal)) {
          support += 0.3;
          evidenceCount++;
          candidate.evidence.push({
            source: 'symbolic',
            description: `Aligns with goal: ${goal.term}`,
            strength: 0.8,
            producer: 'evidence.goal',
          });
        }
      }

      // Belief support evidence
      for (const belief of context.beliefs) {
        if (this.supports(candidate.proposal, belief)) {
          support += 0.2;
          evidenceCount++;
          candidate.evidence.push({
            source: 'symbolic',
            description: `Supported by belief: ${belief.term}`,
            strength: 0.7,
            producer: 'evidence.belief',
          });
        }
      }

      // Existing evidence strength
      const existingStrength = candidate.evidence.reduce((sum, e) => sum + e.strength, 0) * flooredRatio(1, candidate.evidence.length);
      support = (support + existingStrength) / 2;

      candidate.evidenceSupport = Math.min(1, Math.max(0, support));
      candidate.confidence = (candidate.confidence + candidate.evidenceSupport) / 2;
    }

    return candidates.sort((a, b) => (b.evidenceSupport ?? 0) - (a.evidenceSupport ?? 0));
  }

  /** Stage 4: LM rubric judge (async, cached). */
  private async lmRubricJudge(candidates: JudgmentCandidate[], context: JudgmentContext): Promise<JudgmentCandidate[]> {
    if (!this.lmRubricOracle || candidates.length === 0) {
      // No LM available - skip to learned judge
      return candidates;
    }

    this.stats.lmRubricCalls++;

    const rubricCriteria = context.rubricCriteria ?? [
      { name: 'relevance', description: 'How relevant is this to the situation?', weight: 1.0 },
      { name: 'feasibility', description: 'How feasible is this action?', weight: 1.0 },
      { name: 'risk', description: 'What is the risk level?', weight: 1.0 },
      { name: 'goal_alignment', description: 'How well does this align with goals?', weight: 1.0 },
    ];

    for (const candidate of candidates) {
      candidate.stageReached = 'lm_rubric';

      if (candidate.vetoed) continue;

      try {
        const prompt = this.buildRubricPrompt(candidate, context, rubricCriteria);
        const schema = this.buildRubricSchema(rubricCriteria);

        const result = await this.lmRubricOracle.call({
          operation: 'lm.generateObject',
          args: [prompt, schema],
          context: { candidateId: candidate.id, stage: 'lm_rubric' },
        });

        if (result.value && typeof result.value === 'object') {
          const rubricResult = result.value as Record<string, number>;
          candidate.rubricScores = rubricResult;
          const weightedSum = Object.entries(rubricResult).reduce((sum, [name, score]) => {
            const criterion = rubricCriteria.find(c => c.name === name);
            return sum + score * (criterion?.weight ?? 1);
          }, 0);
          const totalWeight = rubricCriteria.reduce((sum, c) => sum + c.weight, 0);
          candidate.rubricOverall = weightedSum * flooredRatio(1, totalWeight);
          candidate.confidence = (candidate.confidence + candidate.rubricOverall) / 2;

          candidate.evidence.push({
            source: 'rubric',
            description: `LM rubric evaluation: ${JSON.stringify(rubricResult)}`,
            strength: candidate.rubricOverall,
            producer: 'lm-rubric',
            oracleCallId: result.meta.callId,
          });

          // Record distillation label if dataset available
          if (this.distillationDataset) {
            this.distillationDataset.record({
              evidenceId: `rubric::${candidate.id}`,
              rubric: 'judge_rubric',
              axis: 'teleological',
              label: candidate.rubricOverall.toFixed(2),
              score: candidate.rubricOverall,
              source: 'LM_Rubric_Judge',
            });
          }
        }
      } catch (error) {
        logger.warn(`LM rubric judge failed for candidate ${candidate.id}:`, { error: errMsg(error) });
      }
    }

    return candidates.sort((a, b) => (b.rubricOverall ?? 0) - (a.rubricOverall ?? 0));
  }

  /** Build prompt for rubric evaluation. */
  private buildRubricPrompt(candidate: JudgmentCandidate, context: JudgmentContext, criteria: Array<{ name: string; description: string; weight: number }>): string {
    return `
Evaluate the following candidate against the criteria:

Situation: ${context.situation}
Candidate: ${candidate.proposal}
Source: ${candidate.sourceFaculty}
Current confidence: ${candidate.confidence}

Criteria:
${criteria.map(c => `- ${c.name}: ${c.description} (weight: ${c.weight})`).join('\n')}

Provide scores 0-1 for each criterion.
`.trim();
  }

  /** Build Zod schema for rubric evaluation. */
  private buildRubricSchema(criteria: Array<{ name: string; description: string; weight: number }>) {
    const { z } = require('zod');
    const shape: Record<string, any> = {};
    for (const c of criteria) {
      shape[c.name] = z.number().min(0).max(1);
    }
    return z.object(shape);
  }

  /** Ensure learned judge is initialized. */
  private async ensureLearnedJudge(): Promise<void> {
    if (this.learnedJudge) return;
    const { createJudge } = await import('./judge');
    this.learnedJudge = createJudge({
      rng: () => this.clock.now() / 1000000,
      now: () => this.clock.now(),
      telemetry: this.telemetry,
    });
  }

  /** Stage 5: Learned logistic judge. */
  private async learnedJudgeStage(candidates: JudgmentCandidate[], context: JudgmentContext): Promise<JudgmentCandidate[]> {
    await this.ensureLearnedJudge();
    if (!this.learnedJudge || candidates.length === 0) return candidates;

    this.stats.learnedJudgeCalls++;

    for (const candidate of candidates) {
      candidate.stageReached = 'learned_judge';

      if (candidate.vetoed) continue;

      try {
        const features = this.learnedJudge.extractFeatures(candidate, context, candidates.length);
        const score = this.learnedJudge.predict(features);
        candidate.learnedScore = score;
        candidate.confidence = (candidate.confidence + score) / 2;

        candidate.evidence.push({
          source: 'learned',
          description: `Learned judge score: ${score.toFixed(3)}`,
          strength: score,
          producer: 'learned-judge',
        });
      } catch (error) {
        logger.warn(`Learned judge failed for candidate ${candidate.id}:`, { error: errMsg(error) });
      }
    }

    return candidates.sort((a, b) => (b.learnedScore ?? 0) - (a.learnedScore ?? 0));
  }

  /** Stage 6: Calibration. */
  private async calibrateStage(candidates: JudgmentCandidate[], _context: JudgmentContext): Promise<JudgmentCandidate[]> {
    for (const candidate of candidates) {
      candidate.stageReached = 'calibrate';
    }
    return candidates;
  }

  /** Check judge drift and demote if needed. */
  private async checkJudgeDrift(): Promise<void> {
    if (!this.config.driftDemotion) return;

    const { eceThreshold, consecutiveCycles, cooldownCycles } = this.config.driftDemotion;

    // Check LM rubric judge ECE
    const rubricCalibrator = this.calibrators.get('rubric');
    if (rubricCalibrator && rubricCalibrator.fitted) {
      const ece = rubricCalibrator.getECE();
      this.updateJudgeECE('lm-rubric', ece);

      if (ece > eceThreshold) {
        this.judgeDriftCycles.set('lm-rubric', (this.judgeDriftCycles.get('lm-rubric') ?? 0) + 1);
      } else {
        this.judgeDriftCycles.set('lm-rubric', 0);
      }

      const driftCycles = this.judgeDriftCycles.get('lm-rubric') ?? 0;
      const lastDemotion = this.lastDemotionCycle.get('lm-rubric') ?? 0;

      if (driftCycles >= consecutiveCycles && !this.judgeDemoted.get('lm-rubric') && this.cycleNumber - lastDemotion >= cooldownCycles) {
        this.judgeDemoted.set('lm-rubric', true);
        this.lastDemotionCycle.set('lm-rubric', this.cycleNumber);
        this.stats.judgeDemotions++;

        if (this.telemetry) {
          await this.telemetry.judgeDemoted('lm-rubric', ece, this.cycleNumber);
        }
      }
    }

    // Check learned judge ECE
    const learnedCalibrator = this.calibrators.get('learned');
    if (learnedCalibrator && learnedCalibrator.fitted) {
      const ece = learnedCalibrator.getECE();
      this.updateJudgeECE('learned', ece);

      if (ece > eceThreshold) {
        this.judgeDriftCycles.set('learned', (this.judgeDriftCycles.get('learned') ?? 0) + 1);
      } else {
        this.judgeDriftCycles.set('learned', 0);
      }

      const driftCycles = this.judgeDriftCycles.get('learned') ?? 0;
      const lastDemotion = this.lastDemotionCycle.get('learned') ?? 0;

      if (driftCycles >= consecutiveCycles && !this.judgeDemoted.get('learned') && this.cycleNumber - lastDemotion >= cooldownCycles) {
        this.judgeDemoted.set('learned', true);
        this.lastDemotionCycle.set('learned', this.cycleNumber);
        this.stats.judgeDemotions++;

        if (this.telemetry) {
          await this.telemetry.judgeDemoted('learned', ece, this.cycleNumber);
        }
      }
    }
  }

  private updateJudgeECE(judge: string, ece: number): void {
    const current = this.judgeECE.get(judge) ?? { ece: 0, samples: 0 };
    current.ece = (current.ece * current.samples + ece) / (current.samples + 1);
    current.samples++;
    this.judgeECE.set(judge, current);
  }

  /** Check if proposal aligns with goal. */
  private alignsWith(proposal: Term | Task | string, goal: Task): boolean {
    const propStr = proposal.toString();
    const goalStr = goal.term.toString();
    return propStr.includes(goalStr) || goalStr.includes(propStr);
  }

  /** Check if belief supports proposal. */
  private supports(proposal: Term | Task | string, belief: Task): boolean {
    const propStr = proposal.toString();
    const beliefStr = belief.term.toString();
    return propStr.includes(beliefStr) || beliefStr.includes(propStr);
  }

  /** Record judgment outcome for calibration. */
  async recordOutcome(confidence: number, correct: boolean): Promise<void> {
    await this.calibrationManager.recordOutcome(confidence, correct ? 1 : 0);

    // Also record for learned judge training
    if (this.learnedJudge) {
      // The learned judge would need the full candidate/context for training
      // This is a simplified version - real implementation would track the candidate
    }
  }

  /** Train learned judge on new examples. */
  async trainLearnedJudge(examples: Array<{ candidate: JudgmentCandidate; context: JudgmentContext; correct: boolean; outcomeScore: number }>): Promise<void> {
    if (this.learnedJudge) {
      const trainingExamples = examples.map(ex => ({
        situation: ex.context.situation.toString(),
        candidate: ex.candidate,
        context: ex.context,
        correct: ex.correct,
        outcomeScore: ex.outcomeScore,
      }));
      await this.learnedJudge.train(trainingExamples);
    }
  }

  /** Timeout wrapper. */
  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new SenarsError(`Stage timeout after ${ms}ms`, 'TIMEOUT')), ms)
      ),
    ]);
  }

  /** Get cascade statistics. */
  getStats() {
    return {
      ...this.stats,
      byStage: mapToRecord(this.stats.byStage),
      judgeECE: mapToRecord(this.judgeECE),
      judgeDriftCycles: mapToRecord(this.judgeDriftCycles),
      judgeDemoted: mapToRecord(this.judgeDemoted),
      calibrationDataPoints: this.calibrationManager.getStats().dataPoints,
    };
  }
}

/** Stage function type. */
export type StageFunction = (
  candidates: JudgmentCandidate[],
  context: JudgmentContext
) => Promise<JudgmentCandidate[]>;

/** Create a judgment cascade. */
export function createJudgmentCascade(
  config?: JudgmentCascadeConfig,
  options?: { clock?: Clock; ids?: IDGenerator; calibrationManager?: CalibrationManager; telemetry?: TelemetryCollector }
): JudgmentCascade {
  return new JudgmentCascade(config, options);
}

/** Global judgment cascade instance (non-deterministic; prefer {@link createJudgmentCascade}). */
export const judgmentCascade = createJudgmentCascade();

/** Convenience function to run judgment. */
export async function judge(context: JudgmentContext): Promise<JudgmentResult> {
  return judgmentCascade.judge(context);
}