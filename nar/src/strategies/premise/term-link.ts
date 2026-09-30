import type { AssociativeRegistry, RecallHit } from '../../memory/associative.js';
import { LINK_LAYER } from '../../memory/links/types.js';
import type { MemoryView } from '../../memory/view.js';
import { getPredicate, getSubject, type Term, TermSet } from '../../terms';
import type { Task } from '../../types';
import { createSecondaryTask } from '../../types';
import type { Strategy } from '../types.js';

/** Minimum belief priority for a link to be promoted to a secondary task. */
const MIN_TASK_PRIORITY = 0.3;

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
export class LinkLayerStrategy implements Strategy {
  readonly name: string;

  constructor(
    readonly layer: string,
    name?: string,
    private readonly config: LinkLayerStrategyConfig = {}
  ) {
    this.name = name ?? `${layer}-link`;
  }

  selectSecondary(task: Task, memory: MemoryView): Task[] {
    const { minStrength = 0.1, limit = 20 } = this.config;
    const memories = memory.getAssociativeMemories();

    const hits = [
      ...memories.recall(this.layer, task.term, { minStrength, limit }),
      ...this.associativeNeighbours(task.term, memories, limit),
    ];

    return this.toTasks(hits, memory);
  }

  /** Further terms this memory treats as associative neighbours of the term. */
  protected associativeNeighbours(
    _term: Term,
    _memories: AssociativeRegistry,
    _limit: number
  ): RecallHit[] {
    return [];
  }

  private toTasks(hits: RecallHit[], memory: MemoryView): Task[] {
    const results: Task[] = [];
    const seen = new TermSet();

    for (const hit of hits) {
      if (seen.has(hit.term)) continue;
      seen.add(hit.term);

      const concept = memory.getConcept(hit.term);
      const belief = concept?.beliefBag.peek();
      if (!concept || !belief) continue;

      const secondary = createSecondaryTask(
        concept.term,
        hit.strength,
        belief.truth ? { f: belief.truth.f, c: belief.truth.c } : undefined,
        'belief'
      );

      if (secondary.budget.priority >= MIN_TASK_PRIORITY) results.push(secondary);
    }

    return results;
  }
}

/**
 * Term-link premise selection: a task term's links plus the links of its
 * subject and predicate, matching Narsese's compound-term structure.
 */
export class TermLinkStrategy extends LinkLayerStrategy {
  constructor(config?: LinkLayerStrategyConfig) {
    super(LINK_LAYER.TERM, 'term-link', config);
  }

  protected override associativeNeighbours(
    term: Term,
    memories: AssociativeRegistry,
    limit: number
  ): RecallHit[] {
    const subject = getSubject(term);
    const predicate = getPredicate(term);
    if (!subject && !predicate) return [];

    return [
      ...(subject ? memories.recall(this.layer, subject, { limit }) : []),
      ...(predicate ? memories.recall(this.layer, predicate, { limit }) : []),
    ];
  }
}

/** Semantic-link premise selection over the embedding layer. */
export class EmbeddingLinkStrategy extends LinkLayerStrategy {
  constructor(config?: LinkLayerStrategyConfig) {
    super(LINK_LAYER.EMBEDDING, 'embedding-link', config);
  }
}

export const createLinkLayerStrategy = (
  layer: string,
  config?: LinkLayerStrategyConfig
): Strategy => new LinkLayerStrategy(layer, undefined, config);
