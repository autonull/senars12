import { uniqueBy } from '@senars/util/collections';
import { LINK_LAYER } from '../../memory/links/types';
import { getPredicate, getSubject, termKey } from '../../terms';
import { createSecondaryTask } from '../../types';
import { Strategy as BaseStrategy } from '../base';
/** Minimum belief priority for a link to be promoted to a secondary task. */
const MIN_TASK_PRIORITY = 0.3;
/**
 * Premise selection from any associative-memory layer.
 *
 * The layer dimension is the strategy's parameter, not a subclass: a new layer
 * becomes a premise source by being registered with the `LinkManager` and
 * named here. `CompositeStrategy` combines several of them per task.
 */
export class LinkLayerStrategy extends BaseStrategy {
    config;
    layer;
    constructor(layer, name, config = {}) {
        super(name ?? `${layer}-link`, `Link-layer premise selection (${layer})`);
        this.config = config;
        this.layer = layer;
    }
    selectSecondary(task, memory) {
        const { minStrength = 0.1, limit = 20 } = this.config;
        const memories = memory.getAssociativeMemories();
        const hits = [
            ...memories.recall(this.layer, task.term, { minStrength, limit }),
            ...this.associativeNeighbours(task.term, memories, limit),
        ];
        return this.toTasks(hits, memory);
    }
    /** Further terms this memory treats as associative neighbours of the term. */
    associativeNeighbours(_term, _memories, _limit) {
        return [];
    }
    toTasks(hits, memory) {
        const results = [];
        for (const hit of uniqueBy(hits, ({ term }) => termKey(term))) {
            const concept = memory.getConcept(hit.term);
            const belief = concept?.topBelief();
            if (!concept || !belief)
                continue;
            const secondary = createSecondaryTask(concept.term, hit.strength, belief.truth, 'belief');
            if (secondary.budget.priority >= MIN_TASK_PRIORITY)
                results.push(secondary);
        }
        return results;
    }
}
/**
 * Term-link premise selection: a task term's links plus the links of its
 * subject and predicate, matching Narsese's compound-term structure.
 */
export class TermLinkStrategy extends LinkLayerStrategy {
    constructor(config) {
        super(LINK_LAYER.TERM, 'term-link', config);
    }
    associativeNeighbours(term, memories, limit) {
        const subject = getSubject(term);
        const predicate = getPredicate(term);
        if (!subject && !predicate)
            return [];
        return [
            ...(subject ? memories.recall(this.layer, subject, { limit }) : []),
            ...(predicate ? memories.recall(this.layer, predicate, { limit }) : []),
        ];
    }
}
/** Semantic-link premise selection over the embedding layer. */
export class EmbeddingLinkStrategy extends LinkLayerStrategy {
    constructor(config) {
        super(LINK_LAYER.EMBEDDING, 'embedding-link', config);
    }
}
export const createLinkLayerStrategy = (layer, config) => new LinkLayerStrategy(layer, undefined, config);
