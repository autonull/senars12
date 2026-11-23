import { ambientRng, type RandomSource, weightedSample } from '@senars/util/random';
import type { Concept } from '../../memory/concept';
import type { MemoryView } from '../../memory/view';
import type { SamplingStrategy } from '../types';
import { ConfigurableStrategy } from '../base';

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
export class WindowedRouletteStrategy extends ConfigurableStrategy<WindowedRouletteConfig>
  implements SamplingStrategy {
  constructor(config: WindowedRouletteConfig = {}) {
    super('windowed-roulette', 'Positional-local roulette sampling within a sliding priority window', config);
  }

  get windowSize(): number {
    return this.config.windowSize ?? 10;
  }

  get rng(): RandomSource {
    return this.config.rng ?? ambientRng;
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