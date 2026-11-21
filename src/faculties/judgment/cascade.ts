/**
 * Judgment Cascade — the System One judgment pipeline.
 *
 * A staged pipeline: candidate generation → filtering → scoring → selection → calibration.
 * Each stage can use faculties and oracles, with fail-closed fallbacks.
 */

import { Truth as TruthOps, Truth } from '../../kernel/truth.js';
import type { Term } from '../../kernel/terms/term.js';
import type { Task } from '../../kernel/types.js';
import type { FacultyInput, FacultyOutput } from '../specs.js';
import { facultyEngine } from '../engine.js';
import { OracleOutput } from '../../oracles/oracle.js';
import type { Clock, IDGenerator, TimestampMs } from '../../kernel/env.js';
import { createCalibrationManager, type CalibrationManager } from './calibration.js';
import { createTelemetryCollector, type TelemetryCollector } from './telemetry.js';

/** Judgment stages. */
export const JUDGMENT_STAGES = [
  'candidates',
  'filter',
  'score',
  'select',
] as const;

export type JudgmentStage = (typeof JUDGMENT_STAGES)[number];

/** Judgment candidate. */
export interface JudgmentCandidate {
  /** Unique candidate ID. */
  id: string;
  /** The proposed judgment (term, task, or action). */
  proposal: Term | Task | string;
  /** Source faculty that generated this candidate. */
  sourceFaculty: string;
  /** Initial confidence. */
  confidence: number;
  /** Evidence supporting this candidate. */
  evidence: JudgmentEvidence[];
  /** Stage this candidate reached. */
  stageReached: JudgmentStage;
  /** Metadata. */
  metadata?: Record<string, unknown>;
}

/** Judgment evidence. */
export interface JudgmentEvidence {
  /** Source of evidence. */
  source: 'faculty' | 'oracle' | 'memory' | 'rule' | 'observation';
  /** Description. */
  description: string;
  /** Strength [0,1]. */
  strength: number;
  /** Faculty/oracle that produced this evidence. */
  producer?: string;
  /** Oracle call ID if from oracle. */
  oracleCallId?: string;
}

/** Judgment context. */
export interface JudgmentContext {
  /** The situation being judged. */
  situation: Term | Task | string;
  /** Current goals. */
  goals: Task[];
  /** Current beliefs. */
  beliefs: Task[];
  /** Available budget. */
  budget: number;
  /** Time pressure (0-1). */
  urgency: number;
  /** Risk tolerance (0-1). */
  riskTolerance: number;
  /** Metadata. */
  metadata?: Record<string, unknown>;
}

/** Judgment result. */
export interface JudgmentResult {
  /** The selected judgment. */
  selected: JudgmentCandidate | null;
  /** All candidates considered. */
  candidates: JudgmentCandidate[];
  /** Final confidence. */
  confidence: number;
  /** Calibration metadata. */
  calibration: JudgmentCalibration;
  /** Stage timings. */
  timings: Record<JudgmentStage, number>;
  /** Whether a fallback was used. */
  fallbackUsed: boolean;
}

/** Judgment calibration. */
export interface JudgmentCalibration {
  /** Whether calibration was applied. */
  applied: boolean;
  /** Calibration factor applied. */
  factor: number;
  /** Pre-calibration confidence. */
  preConfidence: number;
  /** Post-calibration confidence. */
  postConfidence: number;
  /** Calibration method. */
  method: 'isotonic' | 'platt' | 'temperature' | 'beta' | 'none';
}

/** Stage function type. */
export type StageFunction = (
  candidates: JudgmentCandidate[],
  context: JudgmentContext
) => Promise<JudgmentCandidate[]>;

/** Judgment cascade configuration. */
export interface JudgmentCascadeConfig {
  /** Maximum candidates at each stage. */
  maxCandidates?: number;
  /** Minimum confidence to pass filter. */
  filterThreshold?: number;
  /** Enable calibration. */
  enableCalibration?: boolean;
  /** Calibration method. */
  calibrationMethod?: 'isotonic' | 'platt' | 'temperature' | 'beta' | 'none';
  /** Timeout per stage (ms). */
  stageTimeoutMs?: number;
  /** Fallback judgment if all fails. */
  fallbackJudgment?: JudgmentCandidate;
}

/** Default configuration. */
export const defaultJudgmentCascadeConfig: JudgmentCascadeConfig = {
  maxCandidates: 10,
  filterThreshold: 0.3,
  enableCalibration: true,
  calibrationMethod: 'temperature',
  stageTimeoutMs: 5000,
};

/** Judgment cascade. */
export class JudgmentCascade {
  private config: JudgmentCascadeConfig;
  private stages = new Map<JudgmentStage, StageFunction>();
  private stats = {
    totalJudgments: 0,
    fallbackJudgments: 0,
    avgCandidates: 0,
    avgDurationMs: 0,
    byStage: new Map<JudgmentStage, { calls: number; avgDurationMs: number }>(),
  };
  private readonly clock: Clock;
  private readonly ids: IDGenerator;
  private readonly calibrationManager: CalibrationManager;
  private readonly telemetry?: TelemetryCollector;

  constructor(
    config: JudgmentCascadeConfig = {},
    options: { clock?: Clock; ids?: IDGenerator; calibrationManager?: CalibrationManager; telemetry?: TelemetryCollector } = {}
  ) {
    this.config = { ...defaultJudgmentCascadeConfig, ...config };
    this.clock = options.clock ?? { now: () => Date.now() as TimestampMs, setTime: () => {}, advance: () => {} };
    this.ids = options.ids ?? { uuid: () => crypto.randomUUID(), short: () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    this.calibrationManager = options.calibrationManager ?? createCalibrationManager({ method: this.config.calibrationMethod });
    this.telemetry = options.telemetry;
    this.registerDefaultStages();
  }

  /** Register default cascade stages. */
  private registerDefaultStages(): void {
    this.registerStage('candidates', this.generateCandidates.bind(this));
    this.registerStage('filter', this.filterCandidates.bind(this));
    this.registerStage('score', this.scoreCandidates.bind(this));
    this.registerStage('select', this.selectCandidate.bind(this));
    // Calibration is now handled in judge() via CalibrationManager
  }

  /** Register a custom stage function. */
  registerStage(stage: JudgmentStage, fn: StageFunction): void {
    this.stages.set(stage, fn);
  }

  /** Run the full judgment cascade. */
  async judge(context: JudgmentContext): Promise<JudgmentResult> {
    const startTs = this.clock.now();
    this.stats.totalJudgments++;

    // Emit judgment start telemetry
    if (this.telemetry) {
      await this.telemetry.judgmentStart(context);
    }

    let candidates: JudgmentCandidate[] = [];
    const timings: Record<JudgmentStage, number> = {} as Record<JudgmentStage, number>;
    let fallbackUsed = false;

    // Run each stage in sequence
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

        // Emit stage telemetry
        if (this.telemetry) {
          await this.telemetry.judgmentStage(stage, inputCount, candidates.length, timings[stage]);
        }

        // Emit candidate telemetry for candidates generated
        if (this.telemetry && stage === 'candidates') {
          for (const candidate of candidates) {
            await this.telemetry.candidate(candidate, stage);
          }
        }

        // Update stage stats
        const stageStats = this.stats.byStage.get(stage) ?? { calls: 0, avgDurationMs: 0 };
        stageStats.calls++;
        stageStats.avgDurationMs = (stageStats.avgDurationMs * (stageStats.calls - 1) + timings[stage]) / stageStats.calls;
        this.stats.byStage.set(stage, stageStats);
      } catch (error) {
        timings[stage] = this.clock.now() - stageStart;
        if (this.telemetry) {
          await this.telemetry.judgmentStage(stage, candidates.length, candidates.length, timings[stage], String(error));
        }
        console.warn(`Judgment stage ${stage} failed:`, error);
        // Continue with current candidates
      }
    }

    // Select final candidate
    let selected: JudgmentCandidate | null = null;
    if (candidates.length > 0) {
      selected = candidates[0]!; // Already sorted by select stage; length checked
    }

    // Apply fallback if no candidate selected
    if (!selected && this.config.fallbackJudgment) {
      selected = this.config.fallbackJudgment;
      fallbackUsed = true;
      this.stats.fallbackJudgments++;
    }

    // Emit selected telemetry
    if (this.telemetry && selected) {
      await this.telemetry.selected(selected, 1, candidates.length);
    }

    // Calibration using CalibrationManager
    let calibration: JudgmentCalibration = {
      applied: false,
      factor: 1.0,
      preConfidence: selected?.confidence ?? 0,
      postConfidence: selected?.confidence ?? 0,
      method: 'none',
    };

    if (this.config.enableCalibration && selected) {
      calibration = this.calibrationManager.calibrate(selected.confidence);
      selected.confidence = calibration.postConfidence;

      // Emit calibration telemetry
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
    };

    // Emit completion telemetry
    if (this.telemetry) {
      await this.telemetry.complete(result);
    }

    return result;
  }

  /** Stage 1: Generate candidates using faculties. */
  private async generateCandidates(_candidates: JudgmentCandidate[], context: JudgmentContext): Promise<JudgmentCandidate[]> {
    const candidates: JudgmentCandidate[] = [];
    const faculties = ['abduction', 'inference', 'analogy', 'induction', 'planning'];

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
          // Extract candidates from faculty output
          const facultyCandidates = this.extractCandidates(output, faculty);
          candidates.push(...facultyCandidates);
        }
      } catch (error) {
        console.warn(`Faculty ${faculty} failed during candidate generation:`, error);
      }
    }

    // Also add direct candidates from goals/beliefs
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

    // Limit candidates
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
    }

    return candidates;
  }

  /** Stage 2: Filter candidates by threshold. */
  private async filterCandidates(candidates: JudgmentCandidate[], context: JudgmentContext): Promise<JudgmentCandidate[]> {
    return candidates
      .filter(c => c.confidence >= (this.config.filterThreshold ?? 0.3))
      .filter(c => this.passesRiskFilter(c, context))
      .slice(0, this.config.maxCandidates);
  }

  /** Check if candidate passes risk filter. */
  private passesRiskFilter(candidate: JudgmentCandidate, context: JudgmentContext): boolean {
    // Simple risk check: reject if confidence too low for risk tolerance
    const minConfidence = 0.2 + (1 - context.riskTolerance) * 0.5;
    return candidate.confidence >= minConfidence;
  }

  /** Stage 3: Score candidates. */
  private async scoreCandidates(candidates: JudgmentCandidate[], context: JudgmentContext): Promise<JudgmentCandidate[]> {
    for (const candidate of candidates) {
      candidate.confidence = this.computeScore(candidate, context);
      candidate.stageReached = 'score';
    }

    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  /** Compute candidate score. */
  private computeScore(candidate: JudgmentCandidate, context: JudgmentContext): number {
    let score = candidate.confidence;

    // Boost for goal alignment
    for (const goal of context.goals) {
      if (this.alignsWith(candidate.proposal, goal)) {
        score += 0.1;
        break;
      }
    }

    // Boost for belief support
    for (const belief of context.beliefs) {
      if (this.supports(candidate.proposal, belief)) {
        score += 0.05;
      }
    }

    // Penalty for urgency (prefer simpler actions)
    if (context.urgency > 0.7) {
      score *= 0.9;
    }

    // Evidence boost
    const evidenceStrength = candidate.evidence.reduce((sum, e) => sum + e.strength, 0) / Math.max(1, candidate.evidence.length);
    score = (score + evidenceStrength) / 2;

    return Math.min(1, Math.max(0, score));
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

  /** Stage 4: Select best candidate. */
  private async selectCandidate(candidates: JudgmentCandidate[], _context: JudgmentContext): Promise<JudgmentCandidate[]> {
    for (const candidate of candidates) {
      candidate.stageReached = 'select';
    }
    return candidates; // Already sorted by score
  }

  /** Record judgment outcome for calibration. */
  async recordOutcome(confidence: number, correct: boolean): Promise<void> {
    await this.calibrationManager.recordOutcome(confidence, correct ? 1 : 0);
  }

  /** Timeout wrapper. */
  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Stage timeout after ${ms}ms`)), ms)
      ),
    ]);
  }

  /** Get cascade statistics. */
  getStats() {
    return {
      ...this.stats,
      byStage: Object.fromEntries(this.stats.byStage),
      calibrationDataPoints: this.calibrationManager.getStats().dataPoints,
    };
  }
}

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

