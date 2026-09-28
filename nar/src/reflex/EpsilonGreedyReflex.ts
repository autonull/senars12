import type { RandomSource } from '../types/primitives.js';
import { type QEntry, BanditReflex } from './BanditReflex.js';
import type { Reflex } from './Reflex.js';

interface EpsilonGreedyOptions {
  numArms: number;
  epsilon?: number;
  initialValue?: number;
  /** §5s: injectable RNG for exploration. */
  rng?: RandomSource;
}

/** ε-greedy: the mean estimate, with bounded random exploration of young arms. */
export class EpsilonGreedyReflex extends BanditReflex<EpsilonGreedyOptions> implements Reflex<string, number> {
  private readonly epsilon: number;
  private readonly rng: RandomSource;

  constructor(id: string, options: EpsilonGreedyOptions = { numArms: 10 }) {
    super(id, options);
    this.epsilon = options.epsilon ?? 0.1;
    this.rng = options.rng ?? Math.random;
  }

  protected explore(entry: QEntry): number {
    if (entry.count < 5 && this.rng() < this.epsilon) return this.rng();
    return entry.value;
  }
}
