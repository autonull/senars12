import type { Layer } from '../../memory/links/Layer.js';
import { LINK_LAYER } from '../../memory/links/types.js';
import type { LinkEntry } from '../../memory/links/types.js';
import type { MemoryView } from '../../memory/view.js';
import { getPredicate, getSubject, termKey, type Term } from '../../terms';
import type { Task } from '../../types';
import { createSecondaryTask } from '../../types';
import type { Strategy } from '../types.js';

/** Minimum belief priority for a link to be promoted to a secondary task. */
const MIN_TASK_PRIORITY = 0.3;

export interface LinkLayerStrategyConfig {
  minLinkPriority?: number;
  maxLinks?: number;
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
    const layer = memory.getLinkManager().getLayer(this.layer);
    if (!layer) return [];

    const { minLinkPriority = 0.1, maxLinks = 20 } = this.config;
    const links = [
      ...layer.getLinksByTerm(task.term, { minPriority: minLinkPriority, maxResults: maxLinks }),
      ...this.associativeNeighbours(task.term, layer, maxLinks),
    ];

    return this.toTasks(links, memory);
  }

  /** Further link sets this layer treats as associative neighbours of the term. */
  protected associativeNeighbours(_term: Term, _layer: Layer, _maxLinks: number): LinkEntry[] {
    return [];
  }

  private toTasks(links: LinkEntry[], memory: MemoryView): Task[] {
    const results: Task[] = [];
    const seen = new Set<string>();

    for (const link of links) {
      const key = termKey(link.targetTerm);
      if (seen.has(key)) continue;
      seen.add(key);

      const concept = memory.getConcept(link.targetTerm);
      const belief = concept?.beliefBag.peek();
      if (!concept || !belief) continue;

      const secondary = createSecondaryTask(
        concept.term,
        link.priority,
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

  protected override associativeNeighbours(term: Term, layer: Layer, maxLinks: number): LinkEntry[] {
    const subject = getSubject(term);
    const predicate = getPredicate(term);
    if (!subject && !predicate) return [];

    return [
      ...(subject ? layer.getLinksByTerm(subject, { maxResults: maxLinks }) : []),
      ...(predicate ? layer.getLinksByTerm(predicate, { maxResults: maxLinks }) : []),
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

export const createTermLinkStrategy = (config?: LinkLayerStrategyConfig): Strategy =>
  new TermLinkStrategy(config);
