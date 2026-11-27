import { createLogger } from '@senars/util/logger';
import { createStrategy } from '../../reason/strategies/base';
import { createConcatenationComposite, createDedupeByTerm, } from '../composite';
import { Strategy as BaseStrategy } from '../base';
const logger = createLogger({ scope: 'Strategies' });
/**
 * The primitive premise strategies, declared once.
 *
 * `sampleSize` and `limit` are the strategy's *configuration* (TODO27 §2.1):
 * `createPremiseStrategy` reads them from a validated config bag, and the
 * exported singletons below are the `defaultConfig` instances of the same
 * table. One declaration, so a default and a configured variant can never drift.
 */
export const PREMISE_PRIMITIVES = {
    resolution: {
        description: 'Inheritance-focused resolution strategy',
        sampleSize: 15,
        limit: 5,
        filters: ['inheritanceOnly'],
    },
    'goal-driven': {
        description: 'Prioritize high-confidence beliefs related to goals',
        sampleSize: 20,
        limit: 5,
        filters: [{ highConfidence: 0.7 }],
    },
    analogical: {
        description: 'Match inheritance terms with overlapping subject/predicate',
        sampleSize: 15,
        limit: 3,
        filters: ['inheritanceOnly', 'inheritanceOverlap'],
    },
    sampled: {
        description: 'Generic sampled secondary selection',
        sampleSize: 20,
        limit: 5,
    },
    'default-formation': {
        description: 'Default premise formation with small sample',
        sampleSize: 10,
        limit: 5,
        filters: ['sharedAtoms'],
    },
    bag: {
        description: 'Bag-based premise selection with shared atoms and no stamp overlap',
        sampleSize: 10,
        limit: 10,
        filters: ['sharedAtoms', 'noStampOverlap'],
    },
    exhaustive: {
        description: 'Exhaustive premise selection with shared atoms',
        sampleSize: 100,
        limit: 100,
        filters: ['sharedAtoms'],
    },
    semantic: {
        description: 'Semantic similarity via linear(link, embed, priority)',
        // Large sampleSize to capture all concepts (the `concepts` source ignores it).
        sampleSize: 100,
        limit: 10,
        // No default sharedAtoms filter: semantic similarity does not require shared atoms.
        filters: [],
        source: 'concepts',
        scorer: { linear: { link: 0.5, embed: 0.3, pri: 0.2 } },
        minScore: 0.6,
    },
};
/** A primitive premise strategy with its sampling pipeline supplied by config. */
export const createPremiseStrategy = (name, overrides) => {
    const { description: _description, ...primitives } = PREMISE_PRIMITIVES[name];
    return createStrategy({ ...primitives, name, ...overrides });
};
export class DecompositionStrategy extends BaseStrategy {
    constructor() {
        super('decomposition', 'Decompose conjunctions into component beliefs');
    }
    selectSecondary(task, memory) {
        if (task.term.kind !== 'conjunction')
            return [];
        return task.term.args
            .map((arg) => {
            const concept = memory.getConcept(arg);
            return concept?.beliefTask() ?? null;
        })
            .filter((t) => t !== null);
    }
}
/** Adapts a Strategy to the Composable interface. */
function asComposable(strategy) {
    return {
        metadata: { name: strategy.name, description: strategy.metadata?.description ?? '' },
        execute([task, memory]) {
            try {
                return strategy.selectSecondary(task, memory);
            }
            catch (error) {
                logger.warn(`Strategy ${strategy.name} failed: ${error}`);
                return [];
            }
        },
    };
}
export class CompositeStrategy extends BaseStrategy {
    strategies;
    mode;
    composite;
    constructor(strategies, mode = 'concatenate') {
        super('composite', 'Combine multiple premise strategies');
        this.strategies = strategies;
        this.mode = mode;
        const composables = strategies.map(asComposable);
        this.composite =
            mode === 'dedup'
                ? createDedupeByTerm(composables, (t) => t.budget.priority, {
                    name: 'composite',
                    description: 'Deduplicated union of premise strategies',
                })
                : createConcatenationComposite(composables, {
                    name: 'composite',
                    description: 'Concatenated premise strategies',
                });
    }
    selectSecondary(task, memory) {
        return this.composite.execute([task, memory]);
    }
}
export { createPrologResolutionStrategy, PrologResolutionStrategy } from './prolog-resolution';
