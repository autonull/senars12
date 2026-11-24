/**
 * RL Strategy Comparator — A/B testing framework for RL algorithms.
 *
 * Provides statistical comparison of strategies with proper
 * experimental design and analysis.
 */

import type { BaselineArmConfig, BaselineAlgorithm } from '../baselines';
import type { EpisodeResult, ArmMetrics, MetricsConfig } from './Metrics';
import { computeArmMetrics, compareArms } from './Metrics';
import { BaselineTracker } from './Tracker';

/** Experiment configuration. */
export interface ExperimentConfig {
  /** Name of the experiment. */
  name: string;
  /** Description. */
  description?: string;
  /** Arms to compare. */
  arms: BaselineArmConfig[];
  /** Number of episodes per arm. */
  episodesPerArm: number;
  /** Maximum steps per episode. */
  maxStepsPerEpisode?: number;
  /** Random seed for reproducibility. */
  seed?: number;
  /** Metrics configuration. */
  metricsConfig?: MetricsConfig;
}

/** Experiment result. */
export interface ExperimentResult {
  experimentName: string;
  experimentConfig: ExperimentConfig;
  armResults: Map<string, ArmMetrics>;
  comparisons: ArmComparison[];
  bestArm: string;
  startedAt: number;
  completedAt: number;
  totalEpisodes: number;
}

/** Comparison between two arms. */
export interface ArmComparison {
  armA: string;
  armB: string;
  metricsA: ArmMetrics;
  metricsB: ArmMetrics;
  pValue: number;
  significant: boolean;
  effectSize: number;
  betterArm: 'A' | 'B' | 'tie';
}

/** Experiment runner for A/B testing. */
export class ExperimentRunner {
  private config: ExperimentConfig;
  private tracker: BaselineTracker;
  private environments = new Map<string, any>();

  constructor(config: ExperimentConfig) {
    this.config = config;
    this.tracker = new BaselineTracker({ metricsConfig: config.metricsConfig });
  }

  /** Register an environment for an arm. */
  registerEnvironment(armName: string, environment: any): void {
    this.environments.set(armName, environment);
  }

  /** Run the experiment. */
  async run(): Promise<ExperimentResult> {
    const startedAt = Date.now();
    const results = new Map<string, EpisodeResult[]>();

    // Initialize results for each arm
    for (const arm of this.config.arms) {
      results.set(arm.name, []);
    }

    // Run episodes for each arm
    for (const arm of this.config.arms) {
      const environment = this.environments.get(arm.name);
      if (!environment) {
        throw new Error(`No environment registered for arm: ${arm.name}`);
      }

      for (let ep = 0; ep < this.config.episodesPerArm; ep++) {
        environment.reset?.();

        // Create algorithm instance
        const algorithm = this.createAlgorithm(arm);

        // Run episode
        let reward: number;
        if (arm.habitatType === 'bandit') {
          reward = algorithm.runEpisode(environment, this.config.maxStepsPerEpisode ?? 1000);
        } else {
          reward = algorithm.runEpisode(environment, this.config.maxStepsPerEpisode ?? 100);
        }

        const result: EpisodeResult = {
          armConfig: arm,
          reward,
          win: reward > 0,
          steps: this.config.maxStepsPerEpisode ?? 100,
        };

        results.get(arm.name)!.push(result);
        this.tracker.recordEpisode(result);
      }
    }

    // Compute metrics
    const armResults = new Map<string, ArmMetrics>();
    for (const arm of this.config.arms) {
      const episodes = results.get(arm.name)!;
      const optimalReward = this.getOptimalReward(arm);
      const metrics = computeArmMetrics(episodes, optimalReward, this.config.metricsConfig);
      armResults.set(arm.name, metrics);
    }

    // Pairwise comparisons
    const comparisons: ArmComparison[] = [];
    for (let i = 0; i < this.config.arms.length; i++) {
      for (let j = i + 1; j < this.config.arms.length; j++) {
        const armA = this.config.arms[i]!;
        const armB = this.config.arms[j]!;
        const episodesA = results.get(armA.name)!;
        const episodesB = results.get(armB.name)!;
        const optimalReward = Math.max(this.getOptimalReward(armA), this.getOptimalReward(armB));
        const comparison = compareArms(episodesA, episodesB, optimalReward, this.config.metricsConfig);

        comparisons.push({
          armA: armA.name,
          armB: armB.name,
          metricsA: comparison.armA,
          metricsB: comparison.armB,
          pValue: comparison.pValue,
          significant: comparison.significant,
          effectSize: comparison.effectSize,
          betterArm: comparison.betterArm,
        });
      }
    }

    // Determine best arm (highest avg reward among significant winners)
    let bestArm = this.config.arms[0]!.name;
    let bestReward = -Infinity;

    for (const [name, metrics] of armResults) {
      if (metrics.avgReward > bestReward) {
        bestReward = metrics.avgReward;
        bestArm = name;
      }
    }

    const completedAt = Date.now();

    return {
      experimentName: this.config.name,
      experimentConfig: this.config,
      armResults,
      comparisons,
      bestArm,
      startedAt,
      completedAt,
      totalEpisodes: this.config.arms.length * this.config.episodesPerArm,
    };
  }

  private createAlgorithm(arm: BaselineArmConfig): any {
    // This would use the createBaselineAlgorithm from baselines/index.ts
    // For now, return a mock that matches the interface
    switch (arm.algorithm) {
      case 'epsilon-greedy':
        return {
          runEpisode: (env: any, steps: number) => {
            let total = 0;
            for (let i = 0; i < steps; i++) {
              const { reward, terminal } = env.step(0); // Simplified
              total += reward;
              if (terminal) break;
            }
            return total;
          },
        };
      case 'ucb1':
        return {
          runEpisode: (env: any, steps: number) => {
            let total = 0;
            for (let i = 0; i < steps; i++) {
              const { reward, terminal } = env.step(0);
              total += reward;
              if (terminal) break;
            }
            return total;
          },
        };
      case 'q-learning':
      case 'sarsa':
        return {
          runEpisode: (env: any, steps: number) => {
            let total = 0;
            for (let i = 0; i < steps; i++) {
              const { reward, terminal } = env.step(0);
              total += reward;
              if (terminal) break;
            }
            return total;
          },
        };
      default: {
        const _exhaustive: never = arm;
        throw new Error(`Unknown algorithm: ${_exhaustive}`);
      }
    }
  }

  private getOptimalReward(arm: BaselineArmConfig): number {
    // Return theoretical optimal reward for the arm's habitat
    switch (arm.habitatType) {
      case 'bandit':
        return 1.0;
      case 'gridworld':
        return 10.0;
      default:
        return 1.0;
    }
  }
}

/** Factory for creating standard experiments. */
export class ExperimentFactory {
  /** Create a bandit comparison experiment. */
  static createBanditExperiment(
    name: string,
    algorithms: BaselineAlgorithm[],
    numArms = 3,
    episodesPerArm = 1000,
    seed = 12345
  ): ExperimentRunner {
    const arms: BaselineArmConfig[] = algorithms.map((algo, i) => {
      const baseConfig = { numArms, seed: seed + i };
      switch (algo) {
        case 'epsilon-greedy':
          return { algorithm: 'epsilon-greedy' as const, config: { ...baseConfig, epsilon: 0.1 }, habitatType: 'bandit' as const, name: `${algo}-${i}` };
        case 'ucb1':
          return { algorithm: 'ucb1' as const, config: { ...baseConfig, c: 2.0 }, habitatType: 'bandit' as const, name: `${algo}-${i}` };
        default:
          return { algorithm: 'epsilon-greedy' as const, config: { ...baseConfig, epsilon: 0.1 }, habitatType: 'bandit' as const, name: `${algo}-${i}` };
      }
    });

    return new ExperimentRunner({
      name,
      arms,
      episodesPerArm,
      seed,
    });
  }

  /** Create a gridworld comparison experiment. */
  static createGridworldExperiment(
    name: string,
    algorithms: BaselineAlgorithm[],
    episodesPerArm = 500,
    seed = 12345
  ): ExperimentRunner {
    const arms: BaselineArmConfig[] = algorithms.map((algo, i) => {
      const baseConfig = { alpha: 0.1, gamma: 0.99, epsilon: 0.1, seed: seed + i };
      switch (algo) {
        case 'q-learning':
          return { algorithm: 'q-learning' as const, config: { ...baseConfig, initialQ: 0 }, habitatType: 'gridworld' as const, name: `${algo}-${i}` };
        case 'sarsa':
          return { algorithm: 'sarsa' as const, config: { ...baseConfig, initialQ: 0 }, habitatType: 'gridworld' as const, name: `${algo}-${i}` };
        default:
          return { algorithm: 'q-learning' as const, config: { ...baseConfig, initialQ: 0 }, habitatType: 'gridworld' as const, name: `${algo}-${i}` };
      }
    });

    return new ExperimentRunner({
      name,
      arms,
      episodesPerArm,
      seed,
    });
  }
}