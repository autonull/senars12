import { appendFileSync } from 'node:fs';
import { OperationError } from '../types';
import { clamp } from '../utils';
import { PolicyOptimizer } from './PolicyOptimizer.js';
import { PreferenceCollector, type PreferenceData } from './PreferenceCollector.js';
import type { TrajectoryStep } from './ReasoningTrajectoryLogger.js';
import { RewardModel } from './RewardModel.js';

export interface TrainingEntry {
  timestamp: number;
  prompt: unknown;
  chosen: string;
  rejected: string;
  full_chosen_trajectory: TrajectoryStep[];
  full_rejected_trajectory: TrajectoryStep[];
}

export interface RLFPLearnerConfig {
  rewardModel?: RewardModel;
  preferenceCollector?: PreferenceCollector;
  policyOptimizer?: PolicyOptimizer;
  trajectoryLogger?: any;
}

export class RLFPLearner {
  private outputFile = 'rlfp_training_data.jsonl';
  private readonly rewardModel: RewardModel;
  private readonly policyOptimizer: PolicyOptimizer;
  private readonly _preferenceCollector: PreferenceCollector;

  constructor(config: RLFPLearnerConfig = {}) {
    this.rewardModel = config.rewardModel ?? new RewardModel();
    this.policyOptimizer = new PolicyOptimizer(this.rewardModel);
    this._preferenceCollector = config.preferenceCollector ?? new PreferenceCollector();
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
    const prefs = Array.isArray(preferences) ? preferences : [preferences];
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
          lastError = (e as Error).message;
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
    const clampedReward = clamp(reward, -1, 1);
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
      appendFileSync(this.outputFile, JSON.stringify(entry) + '\n');
    } catch (error) {
      throw new OperationError(`RLFPLearner write error: ${(error as Error).message}`, {
        file: this.outputFile,
      });
    }
  }
}
