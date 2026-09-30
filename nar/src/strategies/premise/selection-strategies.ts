import { createLogger } from '@senars/util';
import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import { createStrategy, type StrategyConfig } from '../../reason/strategies/base';
import { type Term, TermMap, type Truth } from '../../terms';
import type { Task } from '../../types';
import { createBeliefTask } from '../../types';
import type { ComponentMetadata, Strategy } from '../types.js';
import type { PremiseOverrides } from './config.js';
import type { FilterSpec } from './primitives.js';
import {
  EmbeddingLinkStrategy as RealEmbeddingLinkStrategy,
  TermLinkStrategy as RealTermLinkStrategy,
} from './term-link';

const logger = createLogger({ scope: 'Strategies' });

export type PremisePrimitiveSpec = { description: string } & Omit<
  StrategyConfig,
  'name' | 'description' | 'filter' | 'truthFilter' | 'sampleSize' | 'limit'
> & { sampleSize: number; limit: number };

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
    filters: [] as FilterSpec[],
    source: 'concepts' as const,
    scorer: { linear: { link: 0.5, embed: 0.3, pri: 0.2 } },
    minScore: 0.6,
  },
} as const satisfies Record<string, PremisePrimitiveSpec>;

/** A primitive premise strategy with its sampling pipeline supplied by config. */
export const createPremiseStrategy = (
  name: keyof typeof PREMISE_PRIMITIVES,
  overrides: PremiseOverrides
): Strategy => {
  const { description: _description, ...primitives } = PREMISE_PRIMITIVES[name];
  return createStrategy({ ...primitives, name, ...overrides });
};

export class DecompositionStrategy implements Strategy {
  readonly metadata: ComponentMetadata = {
    name: 'decomposition',
    description: 'Decompose conjunctions into component beliefs',
  };
  readonly name = 'decomposition';

  selectSecondary(task: Task, memory: MemoryView): Task[] {
    if (task.term.kind !== 'conjunction') return [];

    return task.term.args
      .map((arg) => {
        const concept = memory.getConcept(arg);
        if (!concept) return null;
        const belief = concept.beliefBag.peek();
        if (!belief?.truth) return null;
        return createBeliefTask(arg, belief.truth, concept.priority);
      })
      .filter((t): t is Task => t !== null);
  }
}

/**
 * How several premise strategies combine into one premise set.
 * - `concatenate`: every strategy's premises, in order
 * - `dedup`: one premise per term, keeping the highest-priority claim
 */
export type CompositeMode = 'concatenate' | 'dedup';

export class CompositeStrategy implements Strategy {
  readonly metadata: ComponentMetadata = {
    name: 'composite',
    description: 'Combine multiple premise strategies',
  };
  readonly name = 'composite';

  constructor(
    private strategies: Strategy[],
    private mode: CompositeMode = 'concatenate'
  ) {}

  selectSecondary(task: Task, memory: MemoryView): Task[] {
    const contributions = this.strategies.flatMap((strategy) => {
      try {
        return strategy.selectSecondary(task, memory);
      } catch (error) {
        logger.warn(`Strategy ${strategy.name} failed: ${error}`);
        return [];
      }
    });

    if (this.mode !== 'dedup') return contributions;

    // Highest link/priority wins, deduped on the canonical structural identity.
    const strongest = new TermMap<Task>();
    for (const candidate of contributions) {
      const held = strongest.get(candidate.term);
      if (!held || candidate.budget.priority > held.budget.priority)
        strongest.set(candidate.term, candidate);
    }
    return [...strongest.values()];
  }
}

export { createPrologResolutionStrategy, PrologResolutionStrategy } from './prolog-resolution';
