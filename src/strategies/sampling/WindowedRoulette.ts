import { ambientRng, type RandomSource, weightedSample } from '@senars/util';

import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import type { SamplingStrategy } from '../types.js';

export interface WindowedRouletteConfig {
  windowSize?: number;
  rng?: RandomSource;
}

/**
 * Windowed-Roulette Sampling Strategy
 *
 * Implements the HijackBag paradigm: random window over priority-sorted array
 * -> local sort -> roulette within window -> window slides each call.
 *
 * This provides cheap diversity with locality bias, distinct from global
 * priority-proportional sampling.
 */
export class WindowedRouletteStrategy implements SamplingStrategy {
  readonly metadata = {
    name: 'windowed-roulette',
    description: 'Positional-local roulette sampling within a sliding priority window',
  };
  readonly name = 'windowed-roulette';

  private readonly windowSize: number;
  private readonly rng: RandomSource;

  constructor(config: WindowedRouletteConfig = {}) {
    this.windowSize = config.windowSize ?? 10;
    this.rng = config.rng ?? ambientRng;
  }

  sample(memory: MemoryView, count: number): Concept[] {
    if (count <= 0) return [];
    const window = memory.sampleWindow(this.windowSize, this.rng);
    if (window.length === 0) return [];
    // `sampleWindow` already returns the window in descending priority order and
    // `weightedSample` draws from weights, not positions — the re-rank was a
    // second sort of the window that changed no draw.
    return weightedSample(window, count, (concept) => concept.priority, this.rng);
  }
}

export const createWindowedRouletteStrategy = (config?: WindowedRouletteConfig): SamplingStrategy =>
  new WindowedRouletteStrategy(config);
