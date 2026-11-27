import type { TermTruth } from '@senars/types/truth';
import type { Concept } from '../../memory/concept';
import type { FilterSpec, SampleConfig } from '../../strategies/premise/primitives';
import type { Strategy } from '../../strategies/types';
import type { Task } from '../../types';
type StrategyConfig = Pick<SampleConfig, 'source' | 'scorer' | 'filters' | 'minScore' | 'skipSameTerm'> & {
    name: string;
    sampleSize: number;
    limit?: number;
    /** One-off concept predicate, composed with `filters`. */
    filter?: (concept: Concept, task: Task) => boolean;
    /** One-off truth predicate, composed with the pipeline. */
    truthFilter?: (truth: TermTruth, task: Task) => boolean;
};
/** Named premise strategies are compositions of the source/scorer/filter primitives. */
export declare const createStrategy: (config: StrategyConfig) => Strategy;
export type { FilterSpec, StrategyConfig };
//# sourceMappingURL=base.d.ts.map