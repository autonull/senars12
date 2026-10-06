import {
  cachePath,
  clamp,
  clampSigned,
  createLogger,
  ensureArray,
  entryKey,
  errMsg,
  flooredRatio,
  keyedBy,
  roundTo,
} from '@senars/util';
import { BaseLedgerEntrySchema, createLedger, type Ledger } from '@senars/util/ledger';
import { z } from 'zod';
import { buildDefaults, type CognitiveParameters } from '../config/cognitive-parameters.js';
import type { ParameterLedger } from '../config/parameter-ledger.js';
import { OperationError } from '../types';
import type { RandomSource } from '../types/primitives.js';
import { createKnobSet, type TunableKnob } from './knobs.js';
import { PolicyOptimizer } from './PolicyOptimizer.js';
import { PreferenceCollector, type PreferenceData } from './PreferenceCollector.js';
import type { TrajectoryStep } from './ReasoningTrajectoryLogger.js';
import { RewardModel } from './RewardModel.js';

/** Task outcome for unified reward calculation */
export interface TaskOutcome {
  taskType:
    | 'test'
    | 'scenario'
    | 'contradiction'
    | 'schema'
    | 'capability'
    | 'knob_tune'
    | 'meta_reasoning';
  success: boolean;
  metrics: Record<string, number>; // passRate, latency, coverage, derivationDepth, selfModelAccuracy
}

export interface TrainingEntry {
  timestamp: number;
  prompt: unknown;
  chosen: string;
  rejected: string;
  full_chosen_trajectory: TrajectoryStep[];
  full_rejected_trajectory: TrajectoryStep[];
}

const TrainingEntrySchema = BaseLedgerEntrySchema.extend({
  prompt: z.unknown(),
  chosen: z.string(),
  rejected: z.string(),
  full_chosen_trajectory: z.array(z.unknown()),
  full_rejected_trajectory: z.array(z.unknown()),
});

type TrainingLedgerEntry = z.infer<typeof TrainingEntrySchema>;

export interface RLFPLearnerConfig {
  /** Cycles between optimize() invocations (F7/X28: RLFPConfig flows through construction). */
  optimizeInterval?: number;
  rewardModel?: RewardModel;
  preferenceCollector?: PreferenceCollector;
  policyOptimizer?: PolicyOptimizer;
  trajectoryLogger?: any;
  currentParams?: CognitiveParameters;
  /** Phase B (REFACTOR.todo1): observe tuning writes in the parameter ledger. */
  ledger?: ParameterLedger;
  /** Path for training data ledger (REFACTOR.todo4 Phase B). */
  trainingDataPath?: string;
  /** Seeded randomness for the reward model and the policy optimizer (TODO28 §7.3). */
  rng?: RandomSource;
}

/** The metrics the extrinsic reward is a function of. */
export interface TaskRewardMetrics {
  /** Did the work pass, as a rate in `0..1`. */
  readonly passRate: number;
  readonly avgTestDuration: number;
  /** The previous duration, when there is one to improve on. */
  readonly baselineDuration?: number;
  readonly coverageDelta: number;
  readonly memoryOverage: number;
  readonly cpuThrottleTime: number;
}

/**
 * The extrinsic half of the reward, once.
 *
 * `0.5·passRate + 0.3·clamp(baseline/current, 0, 2)/2 + 0.2·coverageDelta`, less
 * the AIKR penalties. Two methods spelled this out and had already drifted: the
 * task path defaulted `avgTestDuration` to 1 where the metrics path did not, so
 * the same run scored differently depending on which entry point produced it —
 * and a reward function whose value depends on its caller cannot be tuned.
 *
 * The speed score is floored rather than guarded so a sub-100ms run cannot divide
 * by ~zero and award an unbounded speed bonus.
 */
const extrinsicReward = (m: TaskRewardMetrics): number => {
  const speedScore = flooredRatio(m.baselineDuration ?? m.avgTestDuration, m.avgTestDuration, 0.1);
  const reward =
    0.5 * m.passRate + 0.3 * (clamp(speedScore, 0, 2) / 2) + 0.2 * m.coverageDelta;
  return Math.max(0, reward - (0.5 * m.memoryOverage + 0.1 * m.cpuThrottleTime));
};

export class RLFPLearner {
  readonly optimizeInterval: number;
  readonly currentParams: CognitiveParameters;
  private ledger?: ParameterLedger;

  /** Phase B (REFACTOR.todo1): attach after construction (ledger-off default). */
  attachLedger(ledger: ParameterLedger): void {
    this.ledger = ledger;
  }
  private outputFile = 'rlfp_training_data.jsonl';
  private readonly logger = createLogger({ scope: 'rlfp' });
  private readonly rewardModel: RewardModel;
  private readonly policyOptimizer: PolicyOptimizer;
  private readonly _preferenceCollector: PreferenceCollector;
  private readonly knobs: Record<string, TunableKnob>;
  readonly #trainingLedger: Ledger<TrainingLedgerEntry>;

  constructor(config: RLFPLearnerConfig = {}) {
    this.optimizeInterval = config.optimizeInterval ?? 100;
    this.ledger = config.ledger;
    this.rewardModel = config.rewardModel ?? new RewardModel({ rng: config.rng });
    this.policyOptimizer = new PolicyOptimizer(this.rewardModel, { rng: config.rng });
    // Add strategies so the optimizer has something to optimize
    this.policyOptimizer.addStrategy('default', new Map([['rankingMaxAdmissions', 100]]));
    this.policyOptimizer.addStrategy('user_feedback', new Map());
    this._preferenceCollector = config.preferenceCollector ?? new PreferenceCollector();
    this.currentParams = config.currentParams ?? buildDefaults();
    this.knobs = createKnobSet(this.currentParams);
    this.#trainingLedger = createLedger<TrainingLedgerEntry>(
      config.trainingDataPath ?? cachePath('rlfp', 'training'),
      TrainingEntrySchema
    );
  }

  private _trajectoryCount = 0;

  get trajectoryCount(): number {
    return this._trajectoryCount;
  }

  private _lastOptimizeTime: number | undefined;

  get lastOptimizeTime(): number | undefined {
    return this._lastOptimizeTime;
  }

  get preferences(): PreferenceData[] {
    return this._preferenceCollector.getPreferences();
  }

  get policyOptimizerPublic(): PolicyOptimizer {
    return this.policyOptimizer;
  }

  /**
   * Every knob this learner will tune, with the range it may be tuned to.
   *
   * A projection of {@link createKnobSet} rather than a second copy of the ranges.
   * The copy was written before `knobs.ts` derived its rows from the canonical
   * `cognitiveBounds` table, and drifted from it on eight of eight rows — the
   * tuner reported `maxDerivationsPerStep` as unreachable past 500 when the config
   * schema admitted 10 000. It also listed seven of the ten, so two tunable knobs
   * were invisible to the report that exists to show them.
   */
  getTunableKnobs(): Record<string, { current: number; min: number; max: number; step: number }> {
    return keyedBy(Object.entries(this.knobs), entryKey<string>, ([, knob]) => ({
      current: knob.get(),
      min: knob.min,
      max: knob.max,
      step: knob.step,
    }));
  }

  applyTuningUpdate(knob: string, newValue: number): void {
    const k = this.knobs[knob];
    if (k) {
      const oldValue = k.get();
      k.set(newValue);
      if (oldValue !== k.get()) {
        this.ledger?.record({
          writer: 'rlfp',
          scope: 'rlfp',
          parameter: knob,
          oldValue,
          newValue: k.get(),
          at: Date.now(),
          trigger: 'rlfp-tuning',
        });
      }
    }
  }

  calculateReward(m: TaskRewardMetrics): number {
    return extrinsicReward(m);
  }

  /**
   * Calculate reward from generic task outcome with intrinsic rewards
   * Extrinsic: 0.5 * passRate + 0.3 * clamp(baseline/current, 0, 2)/2 + 0.2 * coverageDelta - AIKR penalties
   * Intrinsic: 0.4 * derivationDepthReduction + 0.3 * selfModelAccuracy + 0.3 * contradictionReduction
   * Total: clampSigned(extrinsic + 0.3 * intrinsic)
   * CI penalties: heavy negative reward for typecheck/lint failures
   */
  calculateRewardFromTask(outcome: TaskOutcome): number {
    const m = outcome.metrics;

    // Extrinsic rewards — the same weighted sum `calculateReward` computes.
    const extrinsic = extrinsicReward({
      passRate: m.passRate ?? (outcome.success ? 1 : 0),
      avgTestDuration: m.avgTestDuration ?? 1,
      baselineDuration: m.baselineDuration,
      coverageDelta: m.coverageDelta ?? 0,
      memoryOverage: m.memoryOverage ?? 0,
      cpuThrottleTime: m.cpuThrottleTime ?? 0,
    });

    // Intrinsic rewards (new)
    const derivationDepthReduction = m.derivationDepthReduction ?? 0; // schema promotion → fewer steps
    const selfModelAccuracy = m.selfModelAccuracy ?? 0; // predicted vs actual capability
    const contradictionReduction = m.contradictionReduction ?? 0; // coherence improvement

    const rewardIntrinsic =
      0.4 * derivationDepthReduction + 0.3 * selfModelAccuracy + 0.3 * contradictionReduction;

    // CI penalties: heavy negative reward for typecheck/lint failures (metrics are 0/1 numbers)
    const typecheckFailed = (m.typecheckPassed ?? 1) === 0;
    const lintFailed = (m.lintPassed ?? 1) === 0;
    const ciPenalty = (typecheckFailed ? 0.8 : 0) + (lintFailed ? 0.8 : 0);

    // Combined reward
    const combined = extrinsic + 0.3 * rewardIntrinsic - ciPenalty;
    const total = clampSigned(combined);

    // Structured reward breakdown logging (extrinsic vs intrinsic per task)
    this.logger.debug('reward breakdown', {
      taskType: outcome.taskType,
      success: outcome.success,
      extrinsic: roundTo(extrinsic),
      intrinsic: roundTo(rewardIntrinsic),
      weightedIntrinsic: roundTo(0.3 * rewardIntrinsic),
      ciPenalty: roundTo(ciPenalty),
      total: roundTo(total),
    });

    return total;
  }

  addPreference(preferred: string, rejected: string): void {
    this._preferenceCollector.addPreference({
      trajectoryA: [],
      trajectoryB: [],
      preference: 'A',
      files: { A: preferred, B: rejected },
    });
  }

  optimize(): void {
    this._lastOptimizeTime = Date.now();
    this._trajectoryCount++;
    this.policyOptimizer.optimize();
  }

  updateModel(preferences: PreferenceData[] | PreferenceData): {
    success: boolean;
    count: number;
    error?: string;
  } {
    const prefs = ensureArray(preferences);
    const validPrefs = prefs.filter((p) => p?.preference && p.preference !== 'SKIP');
    if (!validPrefs.length) return { success: true, count: 0 };
    console.info(`RLFPLearner: Processing ${validPrefs.length} preference(s)...`);
    let count = 0;
    let lastError: string | undefined;
    for (const pref of validPrefs) {
      const entry = this.prepareTrainingEntry(pref);
      if (entry) {
        try {
          this.appendToFile(entry);
          count++;
        } catch (e) {
          lastError = errMsg(e);
        }
      }
    }
    console.info(`RLFPLearner: Appended ${count} examples to ${this.outputFile}`);
    return lastError ? { success: false, count, error: lastError } : { success: true, count };
  }

  /**
   * Provide external reward feedback (e.g., from user) to update policy
   * @param reward - Reward value between -1 and 1
   * @param context - Optional context about what the reward is for
   */
  reward(reward: number, context?: string): void {
    const clampedReward = clampSigned(reward);
    // Create a minimal trajectory step for the reward
    const trajectory: TrajectoryStep[] = [
      {
        type: 'reward_feedback',
        timestamp: Date.now(),
        data: { reward: clampedReward, context },
      },
    ];
    // Record outcome with a special strategy name for feedback
    this.policyOptimizer.recordOutcome(trajectory, 'user_feedback');
  }

  /**
   * Reset the RLFPLearner state
   */
  reset(): void {
    this.policyOptimizer.reset();
    this._preferenceCollector.clear();
    this._trajectoryCount = 0;
    this._lastOptimizeTime = undefined;
  }

  private prepareTrainingEntry(pref: PreferenceData): TrainingEntry | null {
    const promptStep = pref.trajectoryA.find((s) => s.type === 'llm_prompt');
    const prompt = promptStep?.data || 'unknown_prompt';
    const [chosen, rejected] =
      pref.preference === 'A'
        ? [pref.trajectoryA, pref.trajectoryB]
        : [pref.trajectoryB, pref.trajectoryA];
    return {
      timestamp: Date.now(),
      prompt,
      chosen: this.extractCompletion(chosen),
      rejected: this.extractCompletion(rejected),
      full_chosen_trajectory: chosen,
      full_rejected_trajectory: rejected,
    };
  }

  private extractCompletion(trajectory: TrajectoryStep[]): string {
    return trajectory
      .filter((s) => s.type !== 'llm_prompt')
      .map((s) => {
        if (s.type === 'tool_call') {
          const data = s.data as any;
          return `<tool_call>${data?.name}(${JSON.stringify(data?.args)})\nResponse: ${JSON.stringify(data?.content ?? data)}`;
        }
        return '';
      })
      .join('\n');
  }

  private appendToFile(entry: TrainingEntry): void {
    try {
      this.#trainingLedger.append({ ...entry, at: entry.timestamp } as TrainingLedgerEntry);
    } catch (error) {
      throw new OperationError(`RLFPLearner write error: ${errMsg(error)}`, {
        file: this.outputFile,
      });
    }
  }
}
