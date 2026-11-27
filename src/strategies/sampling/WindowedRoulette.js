import { ambientRng, weightedSample } from '@senars/util/random';
import { ConfigurableStrategy } from '../base';
/**
 * Windowed-Roulette Sampling Strategy
 *
 * Implements the HijackBag paradigm: random window over priority-sorted array
 * -> local sort -> roulette within window -> window slides each call.
 *
 * This provides cheap diversity with locality bias, distinct from global
 * priority-proportional sampling.
 */
export class WindowedRouletteStrategy extends ConfigurableStrategy {
    constructor(config = {}) {
        super('windowed-roulette', 'Positional-local roulette sampling within a sliding priority window', config);
    }
    get windowSize() {
        return this.config.windowSize ?? 10;
    }
    get rng() {
        return this.config.rng ?? ambientRng;
    }
    sample(memory, count) {
        if (count <= 0)
            return [];
        const window = memory.sampleWindow(this.windowSize, this.rng);
        if (window.length === 0)
            return [];
        // `sampleWindow` already returns the window in descending priority order and
        // `weightedSample` draws from weights, not positions — the re-rank was a
        // second sort of the window that changed no draw.
        return weightedSample(window, count, (concept) => concept.priority, this.rng);
    }
}
export const createWindowedRouletteStrategy = (config) => new WindowedRouletteStrategy(config);
