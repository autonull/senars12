import type { Concept } from '../../memory/concept';
import type { MemoryView } from '../../memory/view';
import type { SamplingStrategy } from '../types';
import { ConfigurableStrategy } from '../base';
interface CompositeSamplingConfig {
    samplers: SamplingStrategy[];
}
/**
 * Union of several sampling strategies: each proposes `count` concepts, the
 * union is deduped by term identity and the highest-priority claim per term
 * wins, then the whole union is cut back to `count`.
 */
export declare class CompositeSampling extends ConfigurableStrategy<CompositeSamplingConfig> implements SamplingStrategy {
    constructor(samplers: SamplingStrategy[]);
    sample(memory: MemoryView, count: number): Concept[];
}
export {};
//# sourceMappingURL=CompositeSampling.d.ts.map