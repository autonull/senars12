import { SeededRNG } from '../environments/RLEnvironments';

/**
 * Epsilon-Greedy Bandit Algorithm
 */
export interface EpsilonGreedyConfig {
  numArms: number;
  epsilon: number;      // Exploration probability
  seed: number;
  initialValue?: number; // Initial Q-value estimate
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
    // Greedy: pick max Q-value (tie-break randomly)
    const maxQ = Math.max(...this.qValues);
    const bestArms = this.qValues
      .map((q, i) => (q === maxQ ? i : -1))
      .filter(i => i >= 0);
    return this.rng.choice(bestArms);
  }

  update(action: number, reward: number): void {
    this.counts[action]++;
    const n = this.counts[action];
    // Incremental average update
    this.qValues[action] += (reward - this.qValues[action]) / n;
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

  /** Serialize state */
  getState(): EpsilonGreedyState {
    return {
      qValues: [...this.qValues],
      counts: [...this.counts],
      totalSteps: this.totalSteps,
      totalReward: this.totalReward,
      rngState: this.rng.getState(),
    };
  }

  /** Deserialize state */
  setState(state: EpsilonGreedyState): void {
    this.qValues = [...state.qValues];
    this.counts = [...state.counts];
    this.totalSteps = state.totalSteps;
    this.totalReward = state.totalReward;
    this.rng.setState(state.rngState);
  }

  /** Run one episode on a bandit environment */
  runEpisode(env: any, maxSteps: number = 1000): number {
    let episodeReward = 0;
    for (let i = 0; i < maxSteps; i++) {
      const action = this.selectAction();
      const { reward, done } = env.step(action);
      this.update(action, reward);
      episodeReward += reward;
      if (done) break;
    }
    return episodeReward;
  }
}

/**
 * UCB1 Bandit Algorithm
 */
export interface UCB1Config {
  numArms: number;
  c: number;            // Exploration parameter
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
    // Play each arm once initially
    for (let i = 0; i < this.numArms; i++) {
      if (this.counts[i] === 0) return i;
    }

    // UCB1 formula: Q(a) + c * sqrt(ln(t) / n(a))
    const t = this.totalSteps + 1;
    let bestAction = 0;
    let bestValue = -Infinity;

    for (let i = 0; i < this.numArms; i++) {
      const ucb = this.qValues[i] + this.c * Math.sqrt(Math.log(t) / this.counts[i]);
      if (ucb > bestValue) {
        bestValue = ucb;
        bestAction = i;
      }
    }
    return bestAction;
  }

  update(action: number, reward: number): void {
    this.counts[action]++;
    const n = this.counts[action];
    this.qValues[action] += (reward - this.qValues[action]) / n;
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

  runEpisode(env: any, maxSteps: number = 1000): number {
    let episodeReward = 0;
    for (let i = 0; i < maxSteps; i++) {
      const action = this.selectAction();
      const { reward, done } = env.step(action);
      this.update(action, reward);
      episodeReward += reward;
      if (done) break;
    }
    return episodeReward;
  }
}