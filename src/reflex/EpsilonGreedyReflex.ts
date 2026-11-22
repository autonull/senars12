import { ambientRng } from '@senars/util/random';
import { isYoung } from '@senars/util/bandit';
import { BanditReflex } from './BanditReflex';
import type { Reflex } from './Reflex';
import type { RandomSource } from '@senars/util';
import type { QEntry } from '@senars/util/bandit';

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
    super(id, options, (entry: QEntry) =>
      isYoung(entry, YOUNG_VISITS) && rng() < epsilon ? rng() : entry.value
    );
  }
}
