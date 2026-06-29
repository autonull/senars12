import type {TrajectoryStep} from './ReasoningTrajectoryLogger.js';
import type {RewardModel} from './RewardModel.js';
import {findCommonFeatures} from './utils.js';

export interface PolicyConfig {
    explorationRate?: number;
    learningRate?: number;
    discountFactor?: number;
    maxIterations?: number;
    convergenceThreshold?: number;
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
    private trajectoryHistory: Array<{
        trajectory: TrajectoryStep[];
        reward: number;
        strategyUsed: string;
    }> = [];
    private rewardModel: RewardModel;
    private readonly config: Required<PolicyConfig>;

    constructor(rewardModel: RewardModel, config: PolicyConfig = {}) {
        this.rewardModel = rewardModel;
        this.config = {
            explorationRate: config.explorationRate ?? 0.1,
            learningRate: config.learningRate ?? 0.01,
            discountFactor: config.discountFactor ?? 0.9,
            maxIterations: config.maxIterations ?? 1000,
            convergenceThreshold: config.convergenceThreshold ?? 0.001,
        };
    }

    getConfig(): Required<PolicyConfig> {
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
            const n = strategy.successRate > 0 ? 10 : 1;
            strategy.successRate = (strategy.successRate * n + reward) / (n + 1);

            const m = strategy.avgReward > 0 ? 10 : 1;
            strategy.avgReward = (strategy.avgReward * m + reward) / (m + 1);
        }

        return reward;
    }

    selectStrategy(_context: string): string {
        if (this.strategies.size === 0) {
            return 'default';
        }

        if (Math.random() < this.config.explorationRate) {
            const strategyArray = Array.from(this.strategies.keys());
            return strategyArray[Math.floor(Math.random() * strategyArray.length)] ?? 'default';
        }

        let bestStrategy = 'default';
        let bestScore = Number.NEGATIVE_INFINITY;

        for (const [name, strategy] of this.strategies.entries()) {
            const score = strategy.priority * strategy.avgReward * (1 + strategy.successRate);
            if (score > bestScore) {
                bestScore = score;
                bestStrategy = name;
            }
        }

        return bestStrategy;
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
            oldValue: {priority: oldPriority, parameters: oldParams},
            newValue: {priority: strategy.priority, parameters: strategy.parameters},
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

        if (this.trajectoryHistory.length < 10) {
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
                relevantHistory.reduce((sum, h) => sum + h.reward, 0) / relevantHistory.length;
            const topQuartile = relevantHistory
                .sort((a, b) => b.reward - a.reward)
                .slice(0, Math.ceil(relevantHistory.length / 4));

            if (topQuartile.length > 0) {
                const _commonFeatures = findCommonFeatures(topQuartile.map((h) => h.trajectory));

                if (avgReward < 0.5) {
                    strategy.priority *= 0.9;

                    updates.push({
                        type: 'parameter',
                        key: strategyName,
                        oldValue: {priority: strategy.priority * 1.1},
                        newValue: {priority: strategy.priority},
                        reason: 'low_average_reward',
                        rewardDelta: avgReward,
                    });
                } else if (avgReward > 0.8) {
                    strategy.priority *= 1.1;

                    updates.push({
                        type: 'parameter',
                        key: strategyName,
                        oldValue: {priority: strategy.priority / 1.1},
                        newValue: {priority: strategy.priority},
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

        let bestName: string | null = null;
        let bestScore = Number.NEGATIVE_INFINITY;

        for (const [name, strategy] of this.strategies.entries()) {
            const score = strategy.priority * strategy.avgReward * (1 + strategy.successRate);
            if (score > bestScore) {
                bestScore = score;
                bestName = name;
            }
        }

        return bestName;
    }

    reset(): void {
        this.trajectoryHistory = [];
        for (const strategy of this.strategies.values()) {
            strategy.successRate = 0;
            strategy.avgReward = 0;
        }
    }

    // Delegates to shared helper in utils.ts
}
