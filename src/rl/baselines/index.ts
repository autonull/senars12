/**
 * RL Baseline Algorithms — Arena arms as config, not code.
 *
 * These are the reference implementations (EpsilonGreedy, UCB1, QLearning, SARSA)
 * used for parity testing and as baseline arms in the arena.
 * Moved from tests/ to src/ for arena arm registration.
 */

import { SeededRNG } from '@senars/util/random';
import type { Game, GameOutcome } from '@senars/game/Game';
import type { GridWorldState, GridAction } from '@senars/game/impls/GridWorldGame';
import type { EpisodeGame } from '../types';

/** ========== BANDIT BASELINES ========== */

export interface EpsilonGreedyConfig {
  numArms: number;
  epsilon: number;
  seed: number;
  initialValue?: number;
}

export interface EpsilonGreedyState {
  qValues: number[];
  counts: number[];
  totalSteps: number;
  totalReward: number;
  rngState: number;
}

export class EpsilonGreedy {
  private rng: SeededRNG;
  private readonly numArms: number;
  private readonly epsilon: number;
  private qValues: number[];
  private counts: number[];
  private totalSteps = 0;
  private totalReward = 0;

  constructor(config: EpsilonGreedyConfig) {
    this.rng = new SeededRNG(config.seed);
    this.numArms = config.numArms;
    this.epsilon = config.epsilon;
    const initVal = config.initialValue ?? 0;
    this.qValues = new Array(config.numArms).fill(initVal);
    this.counts = new Array(config.numArms).fill(0);
  }

  selectAction(): number {
    if (this.rng.next() < this.epsilon) {
      return this.rng.nextInt(this.numArms);
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

  getQValues(): number[] {
    return [...this.qValues];
  }

  getCounts(): number[] {
    return [...this.counts];
  }

  getMetrics(): { avgReward: number; totalSteps: number; totalReward: number } {
    return {
      avgReward: this.totalSteps > 0 ? this.totalReward / this.totalSteps : 0,
      totalSteps: this.totalSteps,
      totalReward: this.totalReward,
    };
  }

  getState(): EpsilonGreedyState {
    return {
      qValues: [...this.qValues],
      counts: [...this.counts],
      totalSteps: this.totalSteps,
      totalReward: this.totalReward,
      rngState: this.rng.getState(),
    };
  }

  setState(state: EpsilonGreedyState): void {
    this.qValues = [...state.qValues];
    this.counts = [...state.counts];
    this.totalSteps = state.totalSteps;
    this.totalReward = state.totalReward;
    this.rng.setState(state.rngState);
  }

  runEpisode(env: Game<number, number>, maxSteps: number = 1000): number {
    let episodeReward = 0;
    for (let i = 0; i < maxSteps; i++) {
      const action = this.selectAction();
      const { reward, terminal } = env.step(action);
      this.update(action, reward);
      episodeReward += reward;
      if (terminal) break;
    }
    return episodeReward;
  }
}

export interface UCB1Config {
  numArms: number;
  c: number;
  seed: number;
  initialValue?: number;
}

export interface UCB1State {
  qValues: number[];
  counts: number[];
  totalSteps: number;
  totalReward: number;
  rngState: number;
}

export class UCB1 {
  private rng: SeededRNG;
  private readonly numArms: number;
  private readonly c: number;
  private qValues: number[];
  private counts: number[];
  private totalSteps = 0;
  private totalReward = 0;

  constructor(config: UCB1Config) {
    this.rng = new SeededRNG(config.seed);
    this.numArms = config.numArms;
    this.c = config.c;
    const initVal = config.initialValue ?? 0;
    this.qValues = new Array(config.numArms).fill(initVal);
    this.counts = new Array(config.numArms).fill(0);
  }

  selectAction(): number {
    for (let i = 0; i < this.numArms; i++) {
      if ((this.counts[i] ?? 0) === 0) return i;
    }
    const t = this.totalSteps + 1;
    let bestAction = 0;
    let bestValue = -Infinity;
    for (let i = 0; i < this.numArms; i++) {
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

  getQValues(): number[] {
    return [...this.qValues];
  }

  getCounts(): number[] {
    return [...this.counts];
  }

  getMetrics(): { avgReward: number; totalSteps: number; totalReward: number } {
    return {
      avgReward: this.totalSteps > 0 ? this.totalReward / this.totalSteps : 0,
      totalSteps: this.totalSteps,
      totalReward: this.totalReward,
    };
  }

  getState(): UCB1State {
    return {
      qValues: [...this.qValues],
      counts: [...this.counts],
      totalSteps: this.totalSteps,
      totalReward: this.totalReward,
      rngState: this.rng.getState(),
    };
  }

  setState(state: UCB1State): void {
    this.qValues = [...state.qValues];
    this.counts = [...state.counts];
    this.totalSteps = state.totalSteps;
    this.totalReward = state.totalReward;
    this.rng.setState(state.rngState);
  }

  runEpisode(env: Game<number, number>, maxSteps: number = 1000): number {
    let episodeReward = 0;
    for (let i = 0; i < maxSteps; i++) {
      const action = this.selectAction();
      const { reward, terminal } = env.step(action);
      this.update(action, reward);
      episodeReward += reward;
      if (terminal) break;
    }
    return episodeReward;
  }
}

/** ========== GRIDWORLD BASELINES ========== */

export interface QLearningConfig {
  alpha: number;
  gamma: number;
  epsilon: number;
  seed: number;
  initialQ?: number;
}

export interface QLearningState {
  qTable: Map<string, number[]>;
  rngState: number;
  totalSteps: number;
  totalReward: number;
}

export class QLearning {
  private rng: SeededRNG;
  private readonly alpha: number;
  private readonly gamma: number;
  private readonly epsilon: number;
  private qTable: Map<string, number[]> = new Map();
  private totalSteps = 0;
  private totalReward = 0;

  constructor(config: QLearningConfig) {
    this.rng = new SeededRNG(config.seed);
    this.alpha = config.alpha;
    this.gamma = config.gamma;
    this.epsilon = config.epsilon;
  }

  selectAction(state: GridWorldState): GridAction {
    const qValues = this.getQValues(state);
    if (this.rng.next() < this.epsilon) {
      return this.rng.nextInt(4) as GridAction;
    }
    const maxQ = Math.max(...qValues);
    const bestActions = qValues
      .map((q, i) => (q === maxQ ? i : -1))
      .filter((i) => i >= 0) as GridAction[];
    return this.rng.choice(bestActions);
  }

  update(
    state: GridWorldState,
    action: GridAction,
    reward: number,
    nextState: GridWorldState,
    done: boolean
  ): void {
    const qValues = this.getQValues(state);
    const nextQValues = this.getQValues(nextState);
    const maxNextQ = done ? 0 : Math.max(...nextQValues);
    const tdTarget = reward + this.gamma * maxNextQ;
    const tdError = tdTarget - (qValues[action] ?? 0);
    qValues[action] = (qValues[action] ?? 0) + this.alpha * tdError;
    this.totalSteps++;
    this.totalReward += reward;
  }

  getQTable(): Map<string, number[]> {
    return new Map(this.qTable);
  }

  getMetrics(): { avgReward: number; totalSteps: number; totalReward: number } {
    return {
      avgReward: this.totalSteps > 0 ? this.totalReward / this.totalSteps : 0,
      totalSteps: this.totalSteps,
      totalReward: this.totalReward,
    };
  }

  getState(): QLearningState {
    return {
      qTable: new Map(this.qTable),
      rngState: this.rng.getState(),
      totalSteps: this.totalSteps,
      totalReward: this.totalReward,
    };
  }

  setState(state: QLearningState): void {
    this.qTable = new Map(state.qTable);
    this.rng.setState(state.rngState);
    this.totalSteps = state.totalSteps;
    this.totalReward = state.totalReward;
  }

  runEpisode(env: EpisodeGame<GridWorldState, GridAction>, maxSteps: number = 100): number {
    let episodeReward = 0;
    env.reset();
    let state = env.state();
    for (let i = 0; i < maxSteps; i++) {
      const action = this.selectAction(state);
      const { reward, terminal } = env.step(action);
      const nextState = env.state();
      this.update(state, action, reward, nextState, terminal);
      episodeReward += reward;
      state = nextState;
      if (terminal) break;
    }
    return episodeReward;
  }

  private getStateKey(state: GridWorldState): string {
    return `${state.row},${state.col}`;
  }

  private getQValues(state: GridWorldState): number[] {
    const key = this.getStateKey(state);
    if (!this.qTable.has(key)) {
      this.qTable.set(key, [0, 0, 0, 0]);
    }
    return this.qTable.get(key)!;
  }
}

export interface SARSAConfig {
  alpha: number;
  gamma: number;
  epsilon: number;
  seed: number;
}

export interface SARSAState {
  qTable: Map<string, number[]>;
  rngState: number;
  totalSteps: number;
  totalReward: number;
}

export class SARSA {
  private rng: SeededRNG;
  private readonly alpha: number;
  private readonly gamma: number;
  private readonly epsilon: number;
  private qTable: Map<string, number[]> = new Map();
  private totalSteps = 0;
  private totalReward = 0;

  constructor(config: SARSAConfig) {
    this.rng = new SeededRNG(config.seed);
    this.alpha = config.alpha;
    this.gamma = config.gamma;
    this.epsilon = config.epsilon;
  }

  selectAction(state: GridWorldState): GridAction {
    const qValues = this.getQValues(state);
    if (this.rng.next() < this.epsilon) {
      return this.rng.nextInt(4) as GridAction;
    }
    const maxQ = Math.max(...qValues);
    const bestActions = qValues
      .map((q, i) => (q === maxQ ? i : -1))
      .filter((i) => i >= 0) as GridAction[];
    return this.rng.choice(bestActions);
  }

  update(
    state: GridWorldState,
    action: GridAction,
    reward: number,
    nextState: GridWorldState,
    nextAction: GridAction,
    done: boolean
  ): void {
    const qValues = this.getQValues(state);
    const nextQValues = this.getQValues(nextState);
    const nextQ = done ? 0 : (nextQValues[nextAction] ?? 0);
    const tdTarget = reward + this.gamma * nextQ;
    const tdError = tdTarget - (qValues[action] ?? 0);
    qValues[action] = (qValues[action] ?? 0) + this.alpha * tdError;
    this.totalSteps++;
    this.totalReward += reward;
  }

  getQTable(): Map<string, number[]> {
    return new Map(this.qTable);
  }

  getMetrics(): { avgReward: number; totalSteps: number; totalReward: number } {
    return {
      avgReward: this.totalSteps > 0 ? this.totalReward / this.totalSteps : 0,
      totalSteps: this.totalSteps,
      totalReward: this.totalReward,
    };
  }

  getState(): SARSAState {
    return {
      qTable: new Map(this.qTable),
      rngState: this.rng.getState(),
      totalSteps: this.totalSteps,
      totalReward: this.totalReward,
    };
  }

  setState(state: SARSAState): void {
    this.qTable = new Map(state.qTable);
    this.rng.setState(state.rngState);
    this.totalSteps = state.totalSteps;
    this.totalReward = state.totalReward;
  }

  runEpisode(env: EpisodeGame<GridWorldState, GridAction>, maxSteps: number = 100): number {
    let episodeReward = 0;
    env.reset();
    let state = env.state();
    let action = this.selectAction(state);
    for (let i = 0; i < maxSteps; i++) {
      const { reward, terminal } = env.step(action);
      const nextState = env.state();
      const nextAction = this.selectAction(nextState);
      this.update(state, action, reward, nextState, nextAction, terminal);
      episodeReward += reward;
      state = nextState;
      action = nextAction;
      if (terminal) break;
    }
    return episodeReward;
  }

  private getStateKey(state: GridWorldState): string {
    return `${state.row},${state.col}`;
  }

  private getQValues(state: GridWorldState): number[] {
    const key = this.getStateKey(state);
    if (!this.qTable.has(key)) {
      this.qTable.set(key, [0, 0, 0, 0]);
    }
    return this.qTable.get(key)!;
  }
}

/** ========== ARM CONFIG TYPES ========== */

export type BaselineAlgorithm = 'epsilon-greedy' | 'ucb1' | 'q-learning' | 'sarsa';

export interface BaselineArmConfig {
  algorithm: BaselineAlgorithm;
  config: EpsilonGreedyConfig | UCB1Config | QLearningConfig | SARSAConfig;
  habitatType: 'bandit' | 'gridworld';
  name: string;
}

/** Predefined baseline arm configurations for arena. */
export const BASELINE_ARM_CONFIGS: Record<string, BaselineArmConfig> = {
  'epsilon-greedy': {
    algorithm: 'epsilon-greedy',
    config: { numArms: 3, epsilon: 0.1, seed: 123 },
    habitatType: 'bandit',
    name: 'Epsilon-Greedy (ε=0.1)',
  },
  'ucb1': {
    algorithm: 'ucb1',
    config: { numArms: 3, c: 2.0, seed: 123 },
    habitatType: 'bandit',
    name: 'UCB1 (c=2.0)',
  },
  'q-learning': {
    algorithm: 'q-learning',
    config: { alpha: 0.1, gamma: 0.99, epsilon: 0.1, seed: 123 },
    habitatType: 'gridworld',
    name: 'Q-Learning (α=0.1, γ=0.99, ε=0.1)',
  },
  'sarsa': {
    algorithm: 'sarsa',
    config: { alpha: 0.1, gamma: 0.99, epsilon: 0.1, seed: 123 },
    habitatType: 'gridworld',
    name: 'SARSA (α=0.1, γ=0.99, ε=0.1)',
  },
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
      throw new Error(`Unknown algorithm: ${(config as any).algorithm}`);
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