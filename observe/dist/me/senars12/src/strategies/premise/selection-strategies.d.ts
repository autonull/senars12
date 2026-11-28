import type { MemoryView } from '../../memory/view';
import type { Task } from '../../types';
import type { Strategy } from '../types';
import type { PremiseOverrides, PremiseSampleSpec } from './config';
import { type FilterSpec } from './primitives';
import { Strategy as BaseStrategy } from '../base';
export type PremisePrimitiveSpec = PremiseSampleSpec & {
    description: string;
    sampleSize: number;
    limit: number;
};
/**
 * The primitive premise strategies, declared once.
 *
 * `sampleSize` and `limit` are the strategy's *configuration* (TODO27 §2.1):
 * `createPremiseStrategy` reads them from a validated config bag, and the
 * exported singletons below are the `defaultConfig` instances of the same
 * table. One declaration, so a default and a configured variant can never drift.
 */
export declare const PREMISE_PRIMITIVES: {
    readonly resolution: {
        readonly description: 'Inheritance-focused resolution strategy';
        readonly sampleSize: 15;
        readonly limit: 5;
        readonly filters: ["inheritanceOnly"];
    };
    readonly 'goal-driven': {
        readonly description: 'Prioritize high-confidence beliefs related to goals';
        readonly sampleSize: 20;
        readonly limit: 5;
        readonly filters: [{
            readonly highConfidence: 0.7;
        }];
    };
    readonly analogical: {
        readonly description: 'Match inheritance terms with overlapping subject/predicate';
        readonly sampleSize: 15;
        readonly limit: 3;
        readonly filters: ["inheritanceOnly", "inheritanceOverlap"];
    };
    readonly sampled: {
        readonly description: 'Generic sampled secondary selection';
        readonly sampleSize: 20;
        readonly limit: 5;
    };
    readonly 'default-formation': {
        readonly description: 'Default premise formation with small sample';
        readonly sampleSize: 10;
        readonly limit: 5;
        readonly filters: ["sharedAtoms"];
    };
    readonly bag: {
        readonly description: 'Bag-based premise selection with shared atoms and no stamp overlap';
        readonly sampleSize: 10;
        readonly limit: 10;
        readonly filters: ["sharedAtoms", "noStampOverlap"];
    };
    readonly exhaustive: {
        readonly description: 'Exhaustive premise selection with shared atoms';
        readonly sampleSize: 100;
        readonly limit: 100;
        readonly filters: ["sharedAtoms"];
    };
    readonly semantic: {
        readonly description: 'Semantic similarity via linear(link, embed, priority)';
        readonly sampleSize: 100;
        readonly limit: 10;
        readonly filters: FilterSpec[];
        readonly source: 'concepts';
        readonly scorer: {
            readonly linear: {
                readonly link: 0.5;
                readonly embed: 0.3;
                readonly pri: 0.2;
            };
        };
        readonly minScore: 0.6;
    };
};
/** A primitive premise strategy with its sampling pipeline supplied by config. */
export declare const createPremiseStrategy: (name: keyof typeof PREMISE_PRIMITIVES, overrides: PremiseOverrides) => Strategy;
export declare class DecompositionStrategy extends BaseStrategy implements Strategy {
    constructor();
    selectSecondary(task: Task, memory: MemoryView): Task[];
}
/**
 * How several premise strategies combine into one premise set.
 * - `concatenate`: every strategy's premises, in order
 * - `dedup`: one premise per term, keeping the highest-priority claim
 */
export type CompositeMode = 'concatenate' | 'dedup';
export declare class CompositeStrategy extends BaseStrategy implements Strategy {
    private strategies;
    private mode;
    private readonly composite;
    constructor(strategies: Strategy[], mode?: CompositeMode);
    selectSecondary(task: Task, memory: MemoryView): Task[];
}
export { createPrologResolutionStrategy, PrologResolutionStrategy } from './prolog-resolution';
//# sourceMappingURL=selection-strategies.d.ts.map