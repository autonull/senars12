import type { Game, GameOutcome, Perception } from './Game.js';
import { SeededRNG } from './SeededRNG.js';

export interface BanditDriftConfig {
  changeInterval: number;
  changeMagnitude: number;
}

export interface BanditGameConfig {
  numArms: number;
  armMeans: number[];
  seed: number;
  /** Optional non-stationarity: means drift every `changeInterval` steps. */
  drift?: BanditDriftConfig;
  id?: string;
}

/**
 * Multi-armed bandit as a `Game` (DQ2: no Environment layer). Bernoulli rewards;
 * drift draws happen before reward draws to preserve the historical RNG order.
 */
export class BanditGame implements Game<number, number> {
  readonly id: string;
  private readonly rng: SeededRNG;
  private armMeans: number[];
  private readonly drift?: BanditDriftConfig;
  private stepCount = 0;
  private readonly pulls: number[];
  private readonly rewardSum: number[];

  constructor(config: BanditGameConfig) {
    this.id = config.id ?? 'bandit';
    this.rng = new SeededRNG(config.seed);
    this.armMeans = [...config.armMeans];
    this.drift = config.drift;
    this.pulls = config.armMeans.map(() => 0);
    this.rewardSum = config.armMeans.map(() => 0);
  }

  observe(): Perception {
    const features: Record<string, number> = { step: this.stepCount };
    for (let i = 0; i < this.armMeans.length; i++) {
      features[`arm${i}_pulls`] = this.pulls[i] ?? 0;
      features[`arm${i}_avg`] = (this.pulls[i] ?? 0) > 0 ? (this.rewardSum[i] ?? 0) / this.pulls[i]! : 0.5;
    }
    return { stateId: 'bandit', features, confidence: 1.0, terminal: false };
  }

  state(): number {
    return this.stepCount;
  }

  legalActions(): number[] {
    return this.armMeans.map((_, i) => i);
  }

  step(action: number): GameOutcome {
    if (action < 0 || action >= this.armMeans.length) {
      throw new Error(`Invalid action: ${action}`);
    }
    this.stepCount++;
    if (this.drift && this.stepCount % this.drift.changeInterval === 0) {
      this.driftMeans();
    }
    const reward = this.rng.next() < (this.armMeans[action] ?? 0) ? 1 : 0;
    this.pulls[action] = (this.pulls[action] ?? 0) + 1;
    this.rewardSum[action] = (this.rewardSum[action] ?? 0) + reward;
    return { reward, terminal: false };
  }

  reset(): void {
    this.stepCount = 0;
    this.pulls.fill(0);
    this.rewardSum.fill(0);
  }

  getNumArms(): number {
    return this.armMeans.length;
  }

  getCurrentMeans(): number[] {
    return [...this.armMeans];
  }

  getOptimalArm(): number {
    return this.armMeans.indexOf(Math.max(...this.armMeans));
  }

  getStepCount(): number {
    return this.stepCount;
  }

  private driftMeans(): void {
    const magnitude = this.drift?.changeMagnitude ?? 0;
    this.armMeans = this.armMeans.map((mean) => {
      const next = mean + (this.rng.next() * 2 - 1) * magnitude;
      return Math.min(1, Math.max(0, next));
    });
  }
}

export function createBanditGame(config: BanditGameConfig): BanditGame {
  return new BanditGame(config);
}
