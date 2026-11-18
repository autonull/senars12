import { ambientRng, isYoung, type RandomSource } from '@senars/util';
import { BanditReflex } from './BanditReflex.js';
import type { Reflex } from './Reflex.js';

interface EpsilonGreedyOptions {
  numArms: number;
  epsilon?: number;
  /** §5s: injectable RNG for exploration. */
  rng?: RandomSource;
}

/** Arms this young are still eligible for random exploration. */
const YOUNG_VISITS = 5;

/** ε-greedy: the mean estimate, with bounded random exploration of young arms. */
export class EpsilonGreedyReflex
  extends BanditReflex<EpsilonGreedyOptions>
  implements Reflex<string, number>
{
  constructor(id: string, options: EpsilonGreedyOptions = { numArms: 10 }) {
    const epsilon = options.epsilon ?? 0.1;
    const rng = options.rng ?? ambientRng;
    super(id, options, (entry) =>
      isYoung(entry, YOUNG_VISITS) && rng() < epsilon ? rng() : entry.value
    );
  }
}
