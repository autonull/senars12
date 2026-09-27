import type { Concept, Memory } from '../../memory';
import type { Task } from '../../types';
import { createSecondaryTask } from '../../types';
import { extractSymbols, termsEqual, Stamp } from '../../terms';
import { getSubject, getPredicate } from '../../terms';
import type { Term } from '../../terms';
import { getSharedConceptGraph } from '../lm-graph/RuleGraph.js';

export type PremiseSource = (task: Task, memory: Memory, n?: number) => Concept[];

export type PremiseScorer = (task: Task, concept: Concept) => number;

export type PremiseFilter = (task: Task, concept: Concept) => boolean;

export const PREMISE_SOURCES = {
  bag: (task: Task, memory: Memory, n = 10): Concept[] => memory.sample(n),
  links: (task: Task, memory: Memory): Concept[] => {
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
  taskArgs: (task: Task, memory: Memory): Concept[] => {
    const args = task.term.kind === 'conjunction' ? task.term.args : [];
    return args.map((arg) => memory.getConcept(arg)).filter((c): c is Concept => !!c);
  },
  graph: (task: Task, _memory: Memory): Concept[] => {
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

function getLinkStrength(memory: Memory, primary: Term, target: Term): number {
  const linkManager = memory.getLinkManager();
  const links = linkManager.getLinks(primary, { minPriority: 0 });
  const match = links.find((l) => termsEqual(l.targetTerm, target));
  return match ? match.priority : 0;
}

export const PREMISE_SCORERS = {
  priority: (_task: Task, concept: Concept): number => concept.priority,
} as const;

export const PREMISE_SCORERS_CURRIED = {
  linkWeight: (memory: Memory) => (task: Task, concept: Concept): number =>
    getLinkStrength(memory, task.term, concept.term),
  edgeWeight: (_memory: Memory) => (task: Task, concept: Concept): number => {
    const graph = getSharedConceptGraph();
    if (!graph) return 0;
    const coActivations = graph.getCoActivations(task.term, 20);
    const edge = coActivations.find((e) => termsEqual(e.targetTerm, concept.term));
    return edge?.weight ?? 0;
  },
} as const;

export const PREMISE_FILTERS = {
  sharedAtoms: (task: Task, concept: Concept): boolean => {
    const atoms1 = extractSymbols(task.term);
    const atoms2 = extractSymbols(concept.term);
    for (const a of atoms1) {
      if (atoms2.has(a)) return true;
    }
    return false;
  },
  noStampOverlap: (task: Task, concept: Concept): boolean => {
    const belief = concept.beliefBag.peek();
    if (!belief?.stamp) return true;
    const taskStamp = task.stamp;
    if (!taskStamp) return true;
    return !Stamp.overlaps(belief.stamp, taskStamp);
  },
  inheritanceOnly: (_task: Task, concept: Concept): boolean => concept.term.kind === 'inheritance',
  inheritanceOverlap: (task: Task, concept: Concept): boolean => {
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
} as const;

export const PREMISE_FILTERS_CURRIED = {
  highConfidence: (threshold: number) => (task: Task, concept: Concept): boolean => {
    const belief = concept.beliefBag.peek();
    return (belief?.truth?.f ?? 0) > threshold;
  },
} as const;

export const PREMISE_SCORERS_EXTENDED = {
  linear: (weights: { link: number; embed: number; pri: number }) =>
    (memory: Memory) => (task: Task, concept: Concept): number => {
      const linkStrength = getLinkStrength(memory, task.term, concept.term);
      const embeddingSim = 0;
      return (
        weights.link * linkStrength + weights.embed * embeddingSim + weights.pri * concept.priority
      );
    },
} as const;

export type ScorerName = keyof typeof PREMISE_SCORERS | keyof typeof PREMISE_SCORERS_CURRIED;

export type FilterName = keyof typeof PREMISE_FILTERS | keyof typeof PREMISE_FILTERS_CURRIED;

/** A filter name, or a parameterized curried filter. */
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

function resolveScorer(memory: Memory, scorer: SampleConfig['scorer']): PremiseScorer | undefined {
  if (!scorer) return undefined;
  if (typeof scorer === 'string') {
    if (scorer in PREMISE_SCORERS) {
      return PREMISE_SCORERS[scorer as keyof typeof PREMISE_SCORERS];
    }
    if (scorer in PREMISE_SCORERS_CURRIED) {
      return PREMISE_SCORERS_CURRIED[scorer as keyof typeof PREMISE_SCORERS_CURRIED](memory);
    }
    return undefined;
  }
  if ('linear' in scorer) {
    return PREMISE_SCORERS_EXTENDED.linear(scorer.linear)(memory);
  }
  return undefined;
}

/** Bare curried-filter names need a threshold; parameterized specs carry their own. */
const CURRIED_FILTER_DEFAULTS: Partial<Record<FilterName, number>> = { highConfidence: 0.7 };

function resolveFilters(filters: FilterSpec[]): PremiseFilter[] {
  return filters.map((spec) => {
    if (typeof spec === 'object') {
      return PREMISE_FILTERS_CURRIED.highConfidence(spec.highConfidence);
    }
    if (spec in PREMISE_FILTERS) {
      return PREMISE_FILTERS[spec as keyof typeof PREMISE_FILTERS];
    }
    if (spec in PREMISE_FILTERS_CURRIED) {
      return PREMISE_FILTERS_CURRIED[spec as keyof typeof PREMISE_FILTERS_CURRIED](
        CURRIED_FILTER_DEFAULTS[spec] ?? 0
      );
    }
    return () => true;
  });
}

export function samplePremisesFromConfig(
  memory: Memory,
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

  const filterFns = resolveFilters(merged.filters);

  const scored = concepts
    .map((c) => ({ concept: c, score: scorerFn(task, c) }))
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