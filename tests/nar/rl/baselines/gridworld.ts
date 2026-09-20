import type { EpisodeGame } from '../../../../nar/src/rl/types.js';
import type { GridAction, GridWorldState } from '../../../../nar/src/game/GridWorldEnv.js';
import { SeededRNG } from '../../../../nar/src/game/SeededRNG.js';

/**
 * Q-Learning for GridWorld
 */
export interface QLearningConfig {
  alpha: number; // Learning rate
  gamma: number; // Discount factor
  epsilon: number; // Exploration probability
  seed: number;
  initialQ?: number;
}

export interface QLearningState {
  qTable: Map<string, number[]>; // stateKey -> action values
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

/**
 * SARSA for GridWorld (on-policy)
 */
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
