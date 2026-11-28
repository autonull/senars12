import type { AssociativeRegistry, RecallHit } from '../../memory/associative';
import type { MemoryView } from '../../memory/view';
import { type Term } from '../../terms';
import type { Task } from '../../types';
import type { Strategy } from '../types';
import { Strategy as BaseStrategy } from '../base';
export interface LinkLayerStrategyConfig {
    minStrength?: number;
    limit?: number;
}
/**
 * Premise selection from any associative-memory layer.
 *
 * The layer dimension is the strategy's parameter, not a subclass: a new layer
 * becomes a premise source by being registered with the `LinkManager` and
 * named here. `CompositeStrategy` combines several of them per task.
 */
export declare class LinkLayerStrategy extends BaseStrategy implements Strategy {
    private readonly config;
    readonly layer: string;
    constructor(layer: string, name?: string, config?: LinkLayerStrategyConfig);
    selectSecondary(task: Task, memory: MemoryView): Task[];
    /** Further terms this memory treats as associative neighbours of the term. */
    protected associativeNeighbours(_term: Term, _memories: AssociativeRegistry, _limit: number): RecallHit[];
    private toTasks;
}
/**
 * Term-link premise selection: a task term's links plus the links of its
 * subject and predicate, matching Narsese's compound-term structure.
 */
export declare class TermLinkStrategy extends LinkLayerStrategy {
    constructor(config?: LinkLayerStrategyConfig);
    protected associativeNeighbours(term: Term, memories: AssociativeRegistry, limit: number): RecallHit[];
}
/** Semantic-link premise selection over the embedding layer. */
export declare class EmbeddingLinkStrategy extends LinkLayerStrategy {
    constructor(config?: LinkLayerStrategyConfig);
}
export declare const createLinkLayerStrategy: (layer: string, config?: LinkLayerStrategyConfig) => Strategy;
//# sourceMappingURL=term-link.d.ts.map