import type { Concept } from '../../memory/concept';
import type { MemoryView } from '../../memory/view';
import type { SamplingStrategy } from '../types';
import { Strategy } from '../base';
export declare class DiverseSampling extends Strategy implements SamplingStrategy {
    constructor();
    sample(memory: MemoryView, count: number): Concept[];
}
//# sourceMappingURL=DiverseSampling.d.ts.map