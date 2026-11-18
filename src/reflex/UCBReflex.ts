import { ucb, visitConfidence } from '@senars/util';
import { SATURATION_COUNT } from '../constants.js';
import { BanditReflex } from './BanditReflex.js';
import type { Reflex } from './Reflex.js';

interface UCBOptions {
  numArms: number;
  c?: number;
}

/** UCB1: optimistic untried arms, confidence-scaled exploration thereafter. */
export class UCBReflex extends BanditReflex<UCBOptions> implements Reflex<string, number> {
  constructor(id: string, options: UCBOptions = { numArms: 10 }) {
    const confidence = visitConfidence(SATURATION_COUNT);
    const score = ucb(options.c ?? 1.414, 1.0);
    // `+ 1`: the pull being scored counts in the denominator, so a table with no
    // observations yet still scores an untried arm optimistically rather than
    // dividing by a logarithm of zero.
    super(
      id,
      options,
      (entry, totalVisits) => score(entry, totalVisits + 1),
      (count) => (count === 0 ? 0.1 : confidence(count))
    );
  }
}
