import { type RandomSource } from '@senars/util/random';
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
export declare class WindowedRouletteStrategy extends ConfigurableStrategy<WindowedRouletteConfig> implements SamplingStrategy {
    constructor(config?: WindowedRouletteConfig);
    get windowSize(): number;
    get rng(): RandomSource;
    sample(memory: MemoryView, count: number): Concept[];
}
export declare const createWindowedRouletteStrategy: (config?: WindowedRouletteConfig) => SamplingStrategy;
//# sourceMappingURL=WindowedRoulette.d.ts.map