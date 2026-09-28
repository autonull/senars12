import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import type { Task } from '../../types';
import { createSecondaryTask } from '../../types';
import { sharesSymbol, termsEqual, Stamp } from '../../terms';
import { getSubject, getPredicate } from '../../terms';
import type { Term } from '../../terms';
import type { EmbeddingLayer } from '../../memory/links/EmbeddingLayer.js';
import { GRAPH_MEMORY, type RecallHit } from '../../memory/associative.js';
import { LINK_LAYER } from '../../memory/links/types.js';

export type PremiseSource = (task: Task, memory: MemoryView, n?: number) => Concept[];

export type PremiseScorer = (task: Task, concept: Concept) => number;

export type PremiseScorerFactory = (memory: MemoryView) => PremiseScorer;

export type PremiseFilter = (task: Task, concept: Concept) => boolean;

export type PremiseFilterFactory = (...args: unknown[]) => PremiseFilter;

/** Concepts reached through an associative memory, in that memory's strength order. */
const conceptsFrom = (memory: MemoryView, name: string, term: Term, limit: number): Concept[] => {
  const concepts: Concept[] = [];
  for (const hit of memory.getAssociativeMemories().recall(name, term, { limit })) {
    const concept = memory.getConcept(hit.term);
    if (concept) concepts.push(concept);
  }
  return concepts;
};

/** Recall depth for a standalone per-concept strength lookup. */
const LOOKUP_LIMIT = 20;

/** Association strength one memory assigns to a specific target term. */
const strengthOf = (memory: MemoryView, name: string, from: Term, to: Term): number =>
  memory
    .getAssociativeMemories()
    .recall(name, from, { limit: LOOKUP_LIMIT })
    .find((hit) => hit.term.toString() === to.toString())?.strength ?? 0;

/** One recall for the whole scored set, keyed by the target's string form. */
const strengthIndexFor = (
  memory: MemoryView,
  name: string,
  from: Term,
  size: number
): Map<string, number> | null => {
  const hits: RecallHit[] = memory
    .getAssociativeMemories()
    .recall(name, from, { limit: size });
  return hits.length ? new Map(hits.map((hit) => [hit.term.toString(), hit.strength])) : null;
};

export const PREMISE_SOURCES = {
  bag: (task: Task, memory: MemoryView, n = 10): Concept[] => memory.sample(n),
  concepts: (task: Task, memory: MemoryView): Concept[] => memory.listConcepts(),
  links: (task: Task, memory: MemoryView, n = 20): Concept[] =>
    conceptsFrom(memory, LINK_LAYER.TERM, task.term, n),
  taskArgs: (task: Task, memory: MemoryView): Concept[] => {
    const args = task.term.kind === 'conjunction' ? task.term.args : [];
    return args.map((arg) => memory.getConcept(arg)).filter((c): c is Concept => !!c);
  },
  graph: (task: Task, memory: MemoryView, n = 20): Concept[] =>
    conceptsFrom(memory, GRAPH_MEMORY, task.term, n),
} as const;

function getLinkStrength(memory: MemoryView, primary: Term, target: Term): number {
  const linkManager = memory.getLinkManager();
  return linkManager.getLinkPriority(primary, target);
}

/**
 * Unified premise scorer registry.
 * Replaces PREMISE_SCORERS, PREMISE_SCORERS_CURRIED, PREMISE_SCORERS_EXTENDED.
 * Each entry is either a direct PremiseScorer or a PremiseScorerFactory(memory) => PremiseScorer.
 */
interface ScorerEntry {
  create: (memory: MemoryView) => PremiseScorer;
  isExtended?: false;
}

interface ExtendedScorerEntry {
  create: (memory: MemoryView, weights: LinearWeights) => (memory: MemoryView) => PremiseScorer;
  isExtended: true;
}

type ScorerRegistryEntry = ScorerEntry | ExtendedScorerEntry;

function createScorerRegistry() {
  const registry = {
    // Simple scorers (no memory dependency)
    priority: {
      create: (_memory: MemoryView): PremiseScorer => (_task: Task, concept: Concept) => concept.priority,
      isExtended: false as const,
    },
    // Curried scorers (need memory)
    linkWeight: {
      create: (memory: MemoryView): PremiseScorer => (task: Task, concept: Concept) =>
        getLinkStrength(memory, task.term, concept.term),
      isExtended: false as const,
    },
    edgeWeight: {
      create: (memory: MemoryView): PremiseScorer => (task: Task, concept: Concept): number =>
        strengthOf(memory, GRAPH_MEMORY, task.term, concept.term),
      isExtended: false as const,
    },
    // Extended scorers (parameterized factories)
    linear: {
      create: (
        _memory: MemoryView,
        weights: LinearWeights
      ): (memory: MemoryView) => PremiseScorer => {
        return (memory: MemoryView) => (task: Task, concept: Concept): number => {
          const linkStrength = getLinkStrength(memory, task.term, concept.term);
          const embeddingIndex = memory.getEmbeddingIndex?.();
          const embeddingSim =
            embeddingIndex?.similarity?.(task.term.toString(), concept.term.toString()) ?? 0;
          return weights.link * linkStrength + weights.embed * embeddingSim + weights.pri * concept.priority;
        };
      },
      isExtended: true as const,
    },
  } as const;
  return registry;
}

export const PREMISE_SCORER_REGISTRY = createScorerRegistry();

function createFilterRegistry() {
  const registry = {
    sharedAtoms: {
      create: (): PremiseFilter => (task: Task, concept: Concept): boolean =>
        sharesSymbol(task.term, concept.term),
      isCurried: false as const,
    },
    noStampOverlap: {
      create: (): PremiseFilter => (task: Task, concept: Concept): boolean => {
        const belief = concept.beliefBag.peek();
        if (!belief?.stamp) return true;
        const taskStamp = task.stamp;
        if (!taskStamp) return true;
        return !Stamp.overlaps(belief.stamp, taskStamp);
      },
      isCurried: false as const,
    },
    inheritanceOnly: {
      create: (): PremiseFilter => (_task: Task, concept: Concept): boolean =>
        concept.term.kind === 'inheritance',
      isCurried: false as const,
    },
    inheritanceOverlap: {
      create: (): PremiseFilter => (task: Task, concept: Concept): boolean => {
        if (task.term.kind !== 'inheritance' || concept.term.kind !== 'inheritance') return true;
        const [taskSub, taskPred] = task.term.args ?? [];
        const [conceptSub, conceptPred] = concept.term.args ?? [];
        return (
          (taskSub !== undefined && conceptSub !== undefined && termsEqual(taskSub, conceptSub)) ||
          (taskSub !== undefined && conceptPred !== undefined && termsEqual(taskSub, conceptPred)) ||
          (taskPred !== undefined && conceptSub !== undefined && termsEqual(taskPred, conceptSub)) ||
          (taskPred !== undefined && conceptPred !== undefined && termsEqual(taskPred, conceptPred))
        );
      },
      isCurried: false as const,
    },
    // Curried filter with parameter
    highConfidence: {
      create: (threshold: number): PremiseFilter => (task: Task, concept: Concept): boolean => {
        const belief = concept.beliefBag.peek();
        return (belief?.truth?.f ?? 0) > threshold;
      },
      isCurried: true as const,
    },
  } as const;
  return registry;
}

export const PREMISE_FILTER_REGISTRY = createFilterRegistry();

export type ScorerName = keyof typeof PREMISE_SCORER_REGISTRY;

export type FilterName = keyof typeof PREMISE_FILTER_REGISTRY;

/** A filter name, or a parameterized curried filter spec. */
export type FilterSpec = FilterName | { highConfidence: number };

/** Registry-derived, never hand-written: adding a source/scorer widens the config automatically. */
export type SourceName = keyof typeof PREMISE_SOURCES;

export interface LinearWeights {
  link: number;
  embed: number;
  pri: number;
}

export interface SampleConfig {
  source?: SourceName;
  scorer?: ScorerName | { linear: LinearWeights };
  filters?: FilterSpec[];
  minScore?: number;
  sampleSize: number;
  limit: number;
  skipSameTerm?: boolean;
  /** Escape hatch for one-off predicates; composed with `filters`, never replaces them. */
  where?: (task: Task, concept: Concept) => boolean;
  /** Escape hatch for truth-value predicates. */
  whereTruth?: (task: Task, truth: { f: number; c: number }) => boolean;
}

const DEFAULT_SAMPLE_CONFIG: Omit<SampleConfig, 'source' | 'scorer' | 'filters' | 'minScore'> & {
  source: keyof typeof PREMISE_SOURCES;
  scorer: ScorerName;
  filters: FilterSpec[];
  minScore: number;
} = {
  source: 'bag' as SourceName,
  scorer: 'priority' as const,
  filters: ['sharedAtoms'],
  minScore: 0,
  sampleSize: 20,
  limit: 10,
  skipSameTerm: true,
};

const HIGH_CONFIDENCE_DEFAULT = 0.7;

function resolveFilters(filters: FilterSpec[]): PremiseFilter[] {
  return filters.map((spec) => {
    if (typeof spec === 'object') {
      const entry = PREMISE_FILTER_REGISTRY.highConfidence;
      return entry.create(spec.highConfidence);
    }
    const entry = PREMISE_FILTER_REGISTRY[spec as keyof typeof PREMISE_FILTER_REGISTRY];
    if (entry && !entry.isCurried) return entry.create();
    return () => true;
  });
}

export function resolveScorer(
  memory: MemoryView,
  scorer: SampleConfig['scorer']
): PremiseScorer | undefined {
  if (!scorer) return undefined;
  if (typeof scorer === 'string') {
    const entry = PREMISE_SCORER_REGISTRY[scorer as keyof typeof PREMISE_SCORER_REGISTRY];
    if (entry && !entry.isExtended) {
      return entry.create(memory);
    }
    return undefined;
  }
  if ('linear' in scorer) {
    const entry = PREMISE_SCORER_REGISTRY.linear;
    if (entry && entry.isExtended) {
      // linear.create returns (memory) => PremiseScorer factory, call it with memory
      const factory = entry.create(memory, scorer.linear);
      return factory(memory);
    }
    return undefined;
  }
  return undefined;
}

export function samplePremisesFromConfig(
  memory: MemoryView,
  task: Task,
  config: SampleConfig
): Task[] {
  const merged = { ...DEFAULT_SAMPLE_CONFIG, ...config };
  const results: Task[] = [];

  const sourceFn = PREMISE_SOURCES[merged.source];
  if (!sourceFn) return results;

  const concepts = sourceFn(task, memory, merged.sampleSize);

  const scorerFn = resolveScorer(memory, merged.scorer);
  if (!scorerFn) return results;

  // One recall per scored set, not one per concept.
  const strengthIndex =
    merged.scorer === 'edgeWeight'
      ? strengthIndexFor(memory, GRAPH_MEMORY, task.term, concepts.length)
      : null;

  const filterFns = resolveFilters(merged.filters);

  const scored = concepts
    .map((c) => ({
      concept: c,
      score: strengthIndex ? (strengthIndex.get(c.term.toString()) ?? 0) : scorerFn(task, c),
    }))
    .filter(({ score }) => score >= merged.minScore)
    .filter(({ concept }) => {
      if (merged.skipSameTerm && termsEqual(concept.term, task.term)) return false;
      if (merged.where && !merged.where(task, concept)) return false;
      for (const filter of filterFns) {
        if (!filter(task, concept)) return false;
      }
      return true;
    })
    .sort((a, b) => b.score - a.score);

  for (const { concept } of scored) {
    const belief = concept.beliefBag.peek();
    if (!belief?.truth) continue;
    if (merged.whereTruth && !merged.whereTruth(task, belief.truth)) continue;
    results.push(createSecondaryTask(concept.term, concept.priority, belief.truth));
    if (results.length >= merged.limit) break;
  }

  return results;
}