import { BoundedRing, maxBy, mean, selectTopN, weightedMean } from '@senars/util';

import type { TrajectoryStep } from './ReasoningTrajectoryLogger.js';
import type { RewardModel } from './RewardModel.js';
import { findCommonFeatures } from './utils.js';
import type { RandomSource } from '../types/primitives.js';

/** Prior-sample weight for a strategy's success rate: proven, or still unproven. */
const PROVEN_WEIGHT = 10;
const UNPROVEN_WEIGHT = 1;

/** The one strategy ranking: priority × mean reward, scaled by proven-ness. */
const STRATEGY_SCORE = (s: Strategy): number =>
  s.priority * s.avgReward * (1 + s.successRate);

export interface PolicyConfig {
  explorationRate?: number;
  learningRate?: number;
  discountFactor?: number;
  maxIterations?: number;
  convergenceThreshold?: number;
  /** §5s: injectable RNG for exploration sampling. */
  rng?: RandomSource;
  /** Trajectory records retained for policy scoring (default 1000). */
  maxHistory?: number;
}

/** One scored `(trajectory, strategy)` outcome the optimizer learns from. */
export interface TrajectoryRecord {
  trajectory: TrajectoryStep[];
  reward: number;
  strategyUsed: string;
}

export interface PolicyUpdate {
  type: 'strategy' | 'parameter' | 'threshold' | 'weight';
  key: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  rewardDelta: number;
}

export interface Strategy {
  name: string;
  parameters: Map<string, unknown>;
  priority: number;
  successRate: number;
  avgReward: number;
}

export class PolicyOptimizer {
  private strategies: Map<string, Strategy> = new Map();
  private readonly trajectoryHistory: BoundedRing<TrajectoryRecord>;
  private rewardModel: RewardModel;
  private readonly config: Omit<Required<PolicyConfig>, 'rng' | 'maxHistory'>;

  constructor(rewardModel: RewardModel, config: PolicyConfig = {}) {
    this.rewardModel = rewardModel;
    this.config = {
      explorationRate: config.explorationRate ?? 0.1,
      learningRate: config.learningRate ?? 0.01,
      discountFactor: config.discountFactor ?? 0.9,
      maxIterations: config.maxIterations ?? 1000,
      convergenceThreshold: config.convergenceThreshold ?? 0.001,
    };
    this.rng = config.rng ?? Math.random;
    this.trajectoryHistory = new BoundedRing<TrajectoryRecord>(config.maxHistory ?? 1000);
  }

  private readonly rng: RandomSource;

  getConfig(): Omit<Required<PolicyConfig>, 'rng' | 'maxHistory'> {
    return this.config;
  }

  recordOutcome(trajectory: TrajectoryStep[], strategyUsed: string): number {
    const reward = this.rewardModel.computeReward(trajectory);

    this.trajectoryHistory.push({
      trajectory,
      reward,
      strategyUsed,
    });

    const strategy = this.strategies.get(strategyUsed);
    if (strategy) {
      // A strategy with no track record is taken at its word; a proven one is held
      // to a ten-sample mean, so one lucky trajectory cannot re-rank the policy.
      strategy.successRate = weightedMean(
        strategy.successRate,
        strategy.successRate > 0 ? PROVEN_WEIGHT : UNPROVEN_WEIGHT,
        reward
      );
      strategy.avgReward = weightedMean(
        strategy.avgReward,
        strategy.avgReward > 0 ? PROVEN_WEIGHT : UNPROVEN_WEIGHT,
        reward
      );
    }

    return reward;
  }

  selectStrategy(_context: string): string {
    if (this.strategies.size === 0) {
      return 'default';
    }

    if (this.rng() < this.config.explorationRate) {
      const strategyArray = Array.from(this.strategies.keys());
      return strategyArray[Math.floor(this.rng() * strategyArray.length)] ?? 'default';
    }

    return this.#bestStrategy() ?? 'default';
  }

  updateStrategy(
    strategyName: string,
    updates: Partial<Pick<Strategy, 'parameters' | 'priority'>>
  ): PolicyUpdate | null {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) return null;

    const oldPriority = strategy.priority;
    const oldParams = new Map(strategy.parameters);

    if (updates.parameters) {
      strategy.parameters = updates.parameters;
    }

    if (updates.priority !== undefined) {
      strategy.priority = updates.priority;
    }

    return {
      type: 'parameter',
      key: strategyName,
      oldValue: { priority: oldPriority, parameters: oldParams },
      newValue: { priority: strategy.priority, parameters: strategy.parameters },
      reason: 'policy_optimization',
      rewardDelta: strategy.avgReward,
    };
  }

  addStrategy(name: string, initialParams: Map<string, unknown> = new Map()): void {
    this.strategies.set(name, {
      name,
      parameters: initialParams,
      priority: 1.0,
      successRate: 0,
      avgReward: 0,
    });
  }

  optimize(iterations = 100): PolicyUpdate[] {
    const updates: PolicyUpdate[] = [];

    if (this.trajectoryHistory.size < 10) {
      return updates;
    }

    for (let i = 0; i < Math.min(iterations, this.strategies.size); i++) {
      const strategyEntries = Array.from(this.strategies.entries());
      if (strategyEntries.length === 0) break;

      const entry = strategyEntries[i % strategyEntries.length];
      if (!entry) break;
      const [strategyName, strategy] = entry;

      const relevantHistory = this.trajectoryHistory.filter((h) => h.strategyUsed === strategyName);

      if (relevantHistory.length < 5) continue;

      const avgReward =
        mean(relevantHistory, (h) => h.reward);
      const topQuartile = selectTopN(
        relevantHistory,
        Math.ceil(relevantHistory.length / 4),
        (h) => h.reward
      );

      if (topQuartile.length > 0) {
        const _commonFeatures = findCommonFeatures(topQuartile.map((h) => h.trajectory));

        if (avgReward < 0.5) {
          strategy.priority *= 0.9;

          updates.push({
            type: 'parameter',
            key: strategyName,
            oldValue: { priority: strategy.priority * 1.1 },
            newValue: { priority: strategy.priority },
            reason: 'low_average_reward',
            rewardDelta: avgReward,
          });
        } else if (avgReward > 0.8) {
          strategy.priority *= 1.1;

          updates.push({
            type: 'parameter',
            key: strategyName,
            oldValue: { priority: strategy.priority / 1.1 },
            newValue: { priority: strategy.priority },
            reason: 'high_average_reward',
            rewardDelta: avgReward,
          });
        }
      }
    }

    return updates;
  }

  getStrategyStats(strategyName: string): Partial<Strategy> | null {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) return null;

    return {
      name: strategy.name,
      priority: strategy.priority,
      successRate: strategy.successRate,
      avgReward: strategy.avgReward,
    };
  }

  getAllStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  getBestStrategy(): string | null {
    if (this.strategies.size === 0) return null;
    return this.#bestStrategy();
  }

  /** The one strategy ranking, shared by the greedy and reporting paths. */
  #bestStrategy(): string | null {
    return maxBy([...this.strategies], ([, s]) => STRATEGY_SCORE(s))?.[0] ?? null;
  }

  reset(): void {
    this.trajectoryHistory.clear();
    for (const strategy of this.strategies.values()) {
      strategy.successRate = 0;
      strategy.avgReward = 0;
    }
  }

  // Delegates to shared helper in utils.ts
}
