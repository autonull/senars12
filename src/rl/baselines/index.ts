/**
 * RL Baseline Algorithms — Arena arms as config, not code.
 *
 * These are the reference implementations (EpsilonGreedy, UCB1, QLearning, SARSA)
 * used for parity testing and as baseline arms in the arena.
 * All algorithms extend shared base classes from `base.ts` for ~60% line reduction.
 */

import { SeededRNG } from '@senars/util/random';
import type { Game } from '@senars/game/Game';
import type { GridWorldState, GridAction } from '@senars/game/impls/GridWorldGame';
import type { EpisodeGame } from '../types';
import {
  BanditBase,
  ValueFunctionBase,
  type BanditConfig,
  type BanditState,
  type VFConfig,
  type VFState,
  type BaselineAlgorithm,
  type BaselineArmConfig,
  type EpsilonGreedyArmConfig,
  type UCB1ArmConfig,
  type QLearningArmConfig,
  type SARSAArmConfig,
} from './base';
import { SenarsError } from '../../errors/senars-error';

/** ========== BANDIT BASELINES ========== */

export interface EpsilonGreedyConfig extends BanditConfig {
  epsilon: number;
}

export interface EpsilonGreedyState extends BanditState {}

export class EpsilonGreedy extends BanditBase<EpsilonGreedyConfig, EpsilonGreedyState> {
  readonly epsilon: number;

  constructor(config: EpsilonGreedyConfig) {
    super(config);
    this.epsilon = config.epsilon;
  }

  selectAction(): number {
    if (this.rng.next() < this.epsilon) {
      return this.rng.nextInt(this.config.numArms);
    }
    const maxQ = Math.max(...this.qValues);
    const bestArms = this.qValues.map((q, i) => (q === maxQ ? i : -1)).filter((i) => i >= 0);
    return this.rng.choice(bestArms);
  }

  update(action: number, reward: number): void {
    this.counts[action] = (this.counts[action] ?? 0) + 1;
    const n = this.counts[action] ?? 1;
    const q = this.qValues[action] ?? 0;
    this.qValues[action] = q + (reward - q) / n;
    this.totalSteps++;
    this.totalReward += reward;
  }
}

export interface UCB1Config extends BanditConfig {
  c: number;
}

export interface UCB1State extends BanditState {}

export class UCB1 extends BanditBase<UCB1Config, UCB1State> {
  readonly c: number;

  constructor(config: UCB1Config) {
    super(config);
    this.c = config.c;
  }

  selectAction(): number {
    for (let i = 0; i < this.config.numArms; i++) {
      if ((this.counts[i] ?? 0) === 0) return i;
    }
    const t = this.totalSteps + 1;
    let bestAction = 0;
    let bestValue = -Infinity;
    for (let i = 0; i < this.config.numArms; i++) {
      const ucb = (this.qValues[i] ?? 0) + this.c * Math.sqrt(Math.log(t) / (this.counts[i] ?? 1));
      if (ucb > bestValue) {
        bestValue = ucb;
        bestAction = i;
      }
    }
    return bestAction;
  }

  update(action: number, reward: number): void {
    this.counts[action] = (this.counts[action] ?? 0) + 1;
    const n = this.counts[action] ?? 1;
    const q = this.qValues[action] ?? 0;
    this.qValues[action] = q + (reward - q) / n;
    this.totalSteps++;
    this.totalReward += reward;
  }
}

/** ========== GRIDWORLD BASELINES ========== */

export interface QLearningConfig extends VFConfig {}

export interface QLearningState extends VFState {}

export class QLearning extends ValueFunctionBase<QLearningConfig, QLearningState, GridWorldState, GridAction> {
  constructor(config: QLearningConfig) {
    super(config);
  }

  protected getStateKey(state: GridWorldState): string {
    return `${state.row},${state.col}`;
  }

  protected getNumActions(_state: GridWorldState): number {
    return 4;
  }

  update(
    state: GridWorldState,
    action: GridAction,
    reward: number,
    nextState: GridWorldState,
    _nextAction: GridAction | undefined,
    done: boolean
  ): void {
    const qValues = this.getQValues(state);
    const nextQValues = this.getQValues(nextState);
    const maxNextQ = done ? 0 : Math.max(...nextQValues);
    const tdTarget = reward + this.config.gamma * maxNextQ;
    const tdError = tdTarget - (qValues[action] ?? 0);
    qValues[action] = (qValues[action] ?? 0) + this.config.alpha * tdError;
    this.totalSteps++;
    this.totalReward += reward;
  }
}

export interface SARSAConfig extends VFConfig {}

export interface SARSAState extends VFState {}

export class SARSA extends ValueFunctionBase<SARSAConfig, SARSAState, GridWorldState, GridAction> {
  constructor(config: SARSAConfig) {
    super(config);
  }

  protected getStateKey(state: GridWorldState): string {
    return `${state.row},${state.col}`;
  }

  protected getNumActions(_state: GridWorldState): number {
    return 4;
  }

  update(
    state: GridWorldState,
    action: GridAction,
    reward: number,
    nextState: GridWorldState,
    nextAction: GridAction | undefined,
    done: boolean
  ): void {
    const qValues = this.getQValues(state);
    const nextQValues = this.getQValues(nextState);
    const nextQ = done ? 0 : (nextAction !== undefined ? nextQValues[nextAction] ?? 0 : 0);
    const tdTarget = reward + this.config.gamma * nextQ;
    const tdError = tdTarget - (qValues[action] ?? 0);
    qValues[action] = (qValues[action] ?? 0) + this.config.alpha * tdError;
    this.totalSteps++;
    this.totalReward += reward;
  }
}

/** ========== ARM CONFIG TYPES ========== */

export type { BaselineAlgorithm, BaselineArmConfig };

/** Predefined baseline arm configurations for arena. */
export const BASELINE_ARM_CONFIGS: Record<string, BaselineArmConfig> = {
  'epsilon-greedy': {
    algorithm: 'epsilon-greedy',
    config: { numArms: 3, epsilon: 0.1, seed: 123 },
    habitatType: 'bandit',
    name: 'Epsilon-Greedy (ε=0.1)',
  } satisfies EpsilonGreedyArmConfig,
  'ucb1': {
    algorithm: 'ucb1',
    config: { numArms: 3, c: 2.0, seed: 123 },
    habitatType: 'bandit',
    name: 'UCB1 (c=2.0)',
  } satisfies UCB1ArmConfig,
  'q-learning': {
    algorithm: 'q-learning',
    config: { alpha: 0.1, gamma: 0.99, epsilon: 0.1, seed: 123 },
    habitatType: 'gridworld',
    name: 'Q-Learning (α=0.1, γ=0.99, ε=0.1)',
  } satisfies QLearningArmConfig,
  'sarsa': {
    algorithm: 'sarsa',
    config: { alpha: 0.1, gamma: 0.99, epsilon: 0.1, seed: 123 },
    habitatType: 'gridworld',
    name: 'SARSA (α=0.1, γ=0.99, ε=0.1)',
  } satisfies SARSAArmConfig,
};

/** Create a baseline algorithm instance from config. */
export function createBaselineAlgorithm(config: BaselineArmConfig):
  | EpsilonGreedy
  | UCB1
  | QLearning
  | SARSA {
  switch (config.algorithm) {
    case 'epsilon-greedy':
      return new EpsilonGreedy(config.config as EpsilonGreedyConfig);
    case 'ucb1':
      return new UCB1(config.config as UCB1Config);
    case 'q-learning':
      return new QLearning(config.config as QLearningConfig);
    case 'sarsa':
      return new SARSA(config.config as SARSAConfig);
    default:
      throw new SenarsError(`Unknown algorithm: ${(config as any).algorithm}`, 'CONFIGURATION_ERROR', { algorithm: (config as any).algorithm });
  }
}

/** Run a baseline algorithm on a habitat via the arena. */
export async function runBaselineArm(
  config: BaselineArmConfig,
  habitat: any,
  maxEpisodes: number,
  maxStepsPerEpisode: number
): Promise<{ rewards: number[]; avgReward: number }> {
  const algorithm = createBaselineAlgorithm(config);
  const rewards: number[] = [];

  for (let ep = 0; ep < maxEpisodes; ep++) {
    habitat.reset?.();
    let reward: number;
    if (config.habitatType === 'bandit') {
      reward = algorithm.runEpisode(habitat, maxStepsPerEpisode);
    } else {
      reward = algorithm.runEpisode(habitat, maxStepsPerEpisode);
    }
    rewards.push(reward);
  }

  const avgReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
  return { rewards, avgReward };
}