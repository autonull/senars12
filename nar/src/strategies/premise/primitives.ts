import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import type { Task } from '../../types';
import { createSecondaryTask } from '../../types';
import { sharesSymbol, termsEqual, Stamp } from '../../terms';
import { getSubject, getPredicate } from '../../terms';
import type { Term } from '../../terms';
import { getSharedConceptGraph } from '../lm-graph/RuleGraph.js';
import type { EmbeddingLayer } from '../../memory/links/EmbeddingLayer.js';

export type PremiseSource = (task: Task, memory: MemoryView, n?: number) => Concept[];

export type PremiseScorer = (task: Task, concept: Concept) => number;

export type PremiseScorerFactory = (memory: MemoryView) => PremiseScorer;

export type PremiseFilter = (task: Task, concept: Concept) => boolean;

export type PremiseFilterFactory = (...args: unknown[]) => PremiseFilter;

export const PREMISE_SOURCES = {
  bag: (task: Task, memory: MemoryView, n = 10): Concept[] => memory.sample(n),
  concepts: (task: Task, memory: MemoryView): Concept[] => memory.listConcepts(),
  links: (task: Task, memory: MemoryView): Concept[] => {
    const linkManager = memory.getLinkManager();
    const termLinks = linkManager.getLayer('term');
    if (!termLinks) return [];
    const links = termLinks.getLinksByTerm(task.term);
    const concepts: Concept[] = [];
    for (const link of links) {
      const concept = memory.getConcept(link.targetTerm);
      if (concept) concepts.push(concept);
    }
    return concepts;
  },
  taskArgs: (task: Task, memory: MemoryView): Concept[] => {
    const args = task.term.kind === 'conjunction' ? task.term.args : [];
    return args.map((arg) => memory.getConcept(arg)).filter((c): c is Concept => !!c);
  },
  graph: (task: Task, _memory: MemoryView): Concept[] => {
    const graph = getSharedConceptGraph();
    if (!graph) return [];
    const coActivations = graph.getCoActivations(task.term, 20);
    const concepts: Concept[] = [];
    for (const edge of coActivations) {
      const concept = _memory.getConcept(edge.targetTerm);
      if (concept) concepts.push(concept);
    }
    return concepts;
  },
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
  create: (memory: MemoryView, weights: { link: number; embed: number; pri: number }) => (memory: MemoryView) => PremiseScorer;
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
      create: (memory: MemoryView): PremiseScorer => (task: Task, concept: Concept) => {
        const graph = getSharedConceptGraph();
        if (!graph) return 0;
        const coActivations = graph.getCoActivations(task.term, 20);
        const edge = coActivations.find((e) => termsEqual(e.targetTerm, concept.term));
        return edge?.weight ?? 0;
      },
      isExtended: false as const,
    },
    // Extended scorers (parameterized factories)
    linear: {
      create: (
        _memory: MemoryView,
        weights: { link: number; embed: number; pri: number }
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

export interface SampleConfig {
  source?: keyof typeof PREMISE_SOURCES;
  scorer?: ScorerName | { linear: { link: number; embed: number; pri: number } };
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
  source: 'bag',
  scorer: 'priority',
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

  // Pre-compute co-activations once if using edgeWeight scorer
  let coActivationMap: Map<string, number> | null = null;
  const isEdgeWeightScorer = typeof merged.scorer === 'string' && merged.scorer === 'edgeWeight';
  if (isEdgeWeightScorer) {
    const graph = getSharedConceptGraph();
    if (graph) {
      const coActivations = graph.getCoActivations(task.term, 20);
      coActivationMap = new Map(coActivations.map((e) => [e.targetTerm.toString(), e.weight]));
    }
  }

  const filterFns = resolveFilters(merged.filters);

  const scored = concepts
    .map((c) => {
      let score: number;
      if (isEdgeWeightScorer && coActivationMap) {
        score = coActivationMap.get(c.term.toString()) ?? 0;
      } else {
        score = scorerFn(task, c);
      }
      return { concept: c, score };
    })
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