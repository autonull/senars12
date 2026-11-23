/**
 * RL Baseline Base Classes — shared infrastructure for bandit and value-function algorithms.
 *
 * Eliminates duplication across EpsilonGreedy, UCB1, QLearning, SARSA.
 * New bandit = ~20 lines; new value-function = ~30 lines.
 */

import { SeededRNG } from '@senars/util/random';
import type { Game, GameOutcome } from '@senars/game/Game';
import type { EpisodeGame } from '../types';

/** ========== BANDIT BASE ========== */

export interface BanditConfig {
  numArms: number;
  seed: number;
  initialValue?: number;
}

export interface BanditState {
  qValues: number[];
  counts: number[];
  totalSteps: number;
  totalReward: number;
  rngState: number;
}

export interface BanditMetrics {
  avgReward: number;
  totalSteps: number;
  totalReward: number;
}

/**
 * Abstract base class for bandit algorithms.
 * Subclasses implement `selectAction` and `update`.
 */
export abstract class BanditBase<Config extends BanditConfig, State extends BanditState> {
  protected rng: SeededRNG;
  protected config: Config;
  protected qValues: number[];
  protected counts: number[];
  protected totalSteps = 0;
  protected totalReward = 0;

  constructor(config: Config) {
    this.config = config;
    this.rng = new SeededRNG(config.seed);
    const initVal = config.initialValue ?? 0;
    this.qValues = new Array(config.numArms).fill(initVal);
    this.counts = new Array(config.numArms).fill(0);
  }

  /** Select an action (arm) — implemented by subclass. */
  abstract selectAction(): number;

  /** Update internal state after receiving reward — implemented by subclass. */
  abstract update(action: number, reward: number): void;

  /** Get current Q-value estimates. */
  getQValues(): number[] {
    return [...this.qValues];
  }

  /** Get pull counts per arm. */
  getCounts(): number[] {
    return [...this.counts];
  }

  /** Get aggregate metrics. */
  getMetrics(): BanditMetrics {
    return {
      avgReward: this.totalSteps > 0 ? this.totalReward / this.totalSteps : 0,
      totalSteps: this.totalSteps,
      totalReward: this.totalReward,
    };
  }

  /** Get serializable state for checkpointing. */
  getState(): State {
    return {
      qValues: [...this.qValues],
      counts: [...this.counts],
      totalSteps: this.totalSteps,
      totalReward: this.totalReward,
      rngState: this.rng.getState(),
    } as State;
  }

  /** Restore state from checkpoint. */
  setState(state: State): void {
    this.qValues = [...state.qValues];
    this.counts = [...state.counts];
    this.totalSteps = state.totalSteps;
    this.totalReward = state.totalReward;
    this.rng.setState(state.rngState);
  }

  /** Run a single episode against a bandit environment. */
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

/** ========== VALUE FUNCTION BASE ========== */

export interface VFConfig {
  alpha: number;
  gamma: number;
  epsilon: number;
  seed: number;
  initialQ?: number;
}

export interface VFState {
  qTable: Map<string, number[]>;
  rngState: number;
  totalSteps: number;
  totalReward: number;
}

export interface VFMetrics {
  avgReward: number;
  totalSteps: number;
  totalReward: number;
}

/**
 * Abstract base class for value-function algorithms (Q-Learning, SARSA).
 * Subclasses implement `update` (TD update rule).
 */
export abstract class ValueFunctionBase<Config extends VFConfig, State extends VFState, S, A> {
  protected rng: SeededRNG;
  protected config: Config;
  protected qTable: Map<string, number[]> = new Map();
  protected totalSteps = 0;
  protected totalReward = 0;

  constructor(config: Config) {
    this.config = config;
    this.rng = new SeededRNG(config.seed);
  }

  /** Get the Q-values for a state, initializing if needed. */
  protected getQValues(state: S): number[] {
    const key = this.getStateKey(state);
    if (!this.qTable.has(key)) {
      const numActions = this.getNumActions(state);
      this.qTable.set(key, new Array(numActions).fill(this.config.initialQ ?? 0));
    }
    return this.qTable.get(key)!;
  }

  /** Convert state to a string key for the Q-table. Implemented by subclass. */
  protected abstract getStateKey(state: S): string;

  /** Get number of actions for a state. Implemented by subclass. */
  protected abstract getNumActions(state: S): number;

  /** Select an action using ε-greedy policy. */
  selectAction(state: S): A {
    const qValues = this.getQValues(state);
    if (this.rng.next() < this.config.epsilon) {
      return this.rng.nextInt(this.getNumActions(state)) as A;
    }
    const maxQ = Math.max(...qValues);
    const bestActions = qValues
      .map((q, i) => (q === maxQ ? i : -1))
      .filter((i) => i >= 0) as A[];
    return this.rng.choice(bestActions);
  }

  /** TD update rule — implemented by subclass (Q-Learning vs SARSA). */
  abstract update(
    state: S,
    action: A,
    reward: number,
    nextState: S,
    nextAction: A | undefined,
    done: boolean
  ): void;

  /** Get copy of Q-table. */
  getQTable(): Map<string, number[]> {
    return new Map(this.qTable);
  }

  /** Get aggregate metrics. */
  getMetrics(): VFMetrics {
    return {
      avgReward: this.totalSteps > 0 ? this.totalReward / this.totalSteps : 0,
      totalSteps: this.totalSteps,
      totalReward: this.totalReward,
    };
  }

  /** Get serializable state for checkpointing. */
  getState(): State {
    return {
      qTable: new Map(this.qTable),
      rngState: this.rng.getState(),
      totalSteps: this.totalSteps,
      totalReward: this.totalReward,
    } as State;
  }

  /** Restore state from checkpoint. */
  setState(state: State): void {
    this.qTable = new Map(state.qTable);
    this.rng.setState(state.rngState);
    this.totalSteps = state.totalSteps;
    this.totalReward = state.totalReward;
  }

  /** Run a single episode against an episodic game environment. */
  runEpisode(env: EpisodeGame<S, A>, maxSteps: number = 100): number {
    let episodeReward = 0;
    env.reset();
    let state = env.state();
    let action = this.selectAction(state);
    for (let i = 0; i < maxSteps; i++) {
      const { reward, terminal } = env.step(action);
      const nextState = env.state();
      const nextAction = terminal ? undefined : this.selectAction(nextState);
      this.update(state, action, reward, nextState, nextAction, terminal);
      episodeReward += reward;
      state = nextState;
      action = nextAction!;
      if (terminal) break;
    }
    return episodeReward;
  }
}

/** ========== ARM CONFIG TYPES ========== */

export type BaselineAlgorithm = 'epsilon-greedy' | 'ucb1' | 'q-learning' | 'sarsa';

export interface EpsilonGreedyArmConfig {
  algorithm: 'epsilon-greedy';
  config: { numArms: number; epsilon: number; seed: number; initialValue?: number };
  habitatType: 'bandit';
  name: string;
}

export interface UCB1ArmConfig {
  algorithm: 'ucb1';
  config: { numArms: number; c: number; seed: number; initialValue?: number };
  habitatType: 'bandit';
  name: string;
}

export interface QLearningArmConfig {
  algorithm: 'q-learning';
  config: { alpha: number; gamma: number; epsilon: number; seed: number; initialQ?: number };
  habitatType: 'gridworld';
  name: string;
}

export interface SARSAArmConfig {
  algorithm: 'sarsa';
  config: { alpha: number; gamma: number; epsilon: number; seed: number; initialQ?: number };
  habitatType: 'gridworld';
  name: string;
}

export type BaselineArmConfig =
  | EpsilonGreedyArmConfig
  | UCB1ArmConfig
  | QLearningArmConfig
  | SARSAArmConfig;