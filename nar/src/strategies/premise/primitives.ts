import { collectUpTo, getOrInsert, type TermTruth } from '@senars/util';
import { GRAPH_MEMORY, type RecallHit } from '../../memory/associative.js';
import type { Concept } from '../../memory/concept.js';
import type { EmbeddingLayer } from '../../memory/links/EmbeddingLayer.js';
import { LINK_LAYER } from '../../memory/links/types.js';
import type { MemoryView } from '../../memory/view.js';
import type { Term } from '../../terms';
import { getArgs, sharesSymbol, Stamp, TermMap, termsEqual } from '../../terms';
import type { Task } from '../../types';
import { ConfigurationError, createSecondaryTask } from '../../types';

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
    .find((hit) => termsEqual(hit.term, to))?.strength ?? 0;

/** One recall for the whole scored set, keyed by the canonical structural identity of the target. */
const strengthIndexFor = (
  memory: MemoryView,
  name: string,
  from: Term,
  size: number
): TermMap<number> | null => {
  const hits: RecallHit[] = memory.getAssociativeMemories().recall(name, from, { limit: size });
  if (hits.length === 0) return null;
  const index = new TermMap<number>();
  for (const hit of hits) index.set(hit.term, hit.strength);
  return index;
};

export const PREMISE_SOURCES = {
  bag: (task: Task, memory: MemoryView, n = 10): Concept[] => memory.topConcepts(n),
  concepts: (task: Task, memory: MemoryView): Concept[] => memory.listConcepts(),
  links: (task: Task, memory: MemoryView, n = 20): Concept[] =>
    conceptsFrom(memory, LINK_LAYER.TERM, task.term, n),
  taskArgs: (task: Task, memory: MemoryView): Concept[] => {
    const args = task.term.kind === 'conjunction' ? getArgs(task.term) : [];
    return args.map((arg) => memory.getConcept(arg)).filter((c): c is Concept => !!c);
  },
  graph: (task: Task, memory: MemoryView, n = 20): Concept[] =>
    conceptsFrom(memory, GRAPH_MEMORY, task.term, n),
} as const;

function getLinkStrength(memory: MemoryView, primary: Term, target: Term): number {
  return memory.links().getLinkPriority(primary, target);
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
      create:
        (_memory: MemoryView): PremiseScorer =>
        (_task: Task, concept: Concept) =>
          concept.priority,
      isExtended: false as const,
    },
    // Curried scorers (need memory)
    linkWeight: {
      create:
        (memory: MemoryView): PremiseScorer =>
        (task: Task, concept: Concept) =>
          getLinkStrength(memory, task.term, concept.term),
      isExtended: false as const,
    },
    edgeWeight: {
      create:
        (memory: MemoryView): PremiseScorer =>
        (task: Task, concept: Concept): number =>
          strengthOf(memory, GRAPH_MEMORY, task.term, concept.term),
      isExtended: false as const,
    },
    // Extended scorers (parameterized factories)
    linear: {
      create: (
        _memory: MemoryView,
        weights: LinearWeights
      ): ((memory: MemoryView) => PremiseScorer) => {
        return (memory: MemoryView) =>
          (task: Task, concept: Concept): number => {
            const linkStrength = getLinkStrength(memory, task.term, concept.term);
            const embeddingIndex = memory.getEmbeddingIndex?.();
            const embeddingSim = embeddingIndex?.similarity?.(task.term, concept.term) ?? 0;
            return (
              weights.link * linkStrength +
              weights.embed * embeddingSim +
              weights.pri * concept.priority
            );
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
      create:
        (): PremiseFilter =>
        (task: Task, concept: Concept): boolean =>
          sharesSymbol(task.term, concept.term),
      isCurried: false as const,
    },
    noStampOverlap: {
      create:
        (): PremiseFilter =>
        (task: Task, concept: Concept): boolean => {
          const belief = concept.topBelief();
          if (!belief?.stamp) return true;
          const taskStamp = task.stamp;
          if (!taskStamp) return true;
          return !Stamp.overlaps(belief.stamp, taskStamp);
        },
      isCurried: false as const,
    },
    inheritanceOnly: {
      create:
        (): PremiseFilter =>
        (_task: Task, concept: Concept): boolean =>
          concept.term.kind === 'inheritance',
      isCurried: false as const,
    },
    inheritanceOverlap: {
      create:
        (): PremiseFilter =>
        (task: Task, concept: Concept): boolean => {
          if (task.term.kind !== 'inheritance' || concept.term.kind !== 'inheritance') return true;
          const [taskSub, taskPred] = getArgs(task.term);
          const [conceptSub, conceptPred] = getArgs(concept.term);
          return (
            (taskSub !== undefined &&
              conceptSub !== undefined &&
              termsEqual(taskSub, conceptSub)) ||
            (taskSub !== undefined &&
              conceptPred !== undefined &&
              termsEqual(taskSub, conceptPred)) ||
            (taskPred !== undefined &&
              conceptSub !== undefined &&
              termsEqual(taskPred, conceptSub)) ||
            (taskPred !== undefined &&
              conceptPred !== undefined &&
              termsEqual(taskPred, conceptPred))
          );
        },
      isCurried: false as const,
    },
    // Curried filter with parameter
    highConfidence: {
      create:
        (threshold: number): PremiseFilter =>
        (task: Task, concept: Concept): boolean => {
          const belief = concept.topBelief();
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
  whereTruth?: (task: Task, truth: TermTruth) => boolean;
}

/**
 * `SampleConfig` with every defaulted field resolved. The two escape hatches
 * keep their optionality: they have no default, and a pipeline that declared
 * one would be inventing a predicate the caller never wrote.
 */
export type ResolvedSampleConfig = Required<
  Omit<SampleConfig, 'scorer' | 'where' | 'whereTruth'>
> & {
  scorer: NonNullable<SampleConfig['scorer']>;
} & Pick<SampleConfig, 'where' | 'whereTruth'>;

/**
 * The sampling pipeline a primitive inherits when it declares no value of its
 * own. The configuration schema's defaults read from here, so the table, the
 * singletons and a user config all resolve to the same pipeline.
 */
export const PREMISE_SAMPLE_FALLBACK: ResolvedSampleConfig = {
  source: 'bag',
  scorer: 'priority',
  filters: ['sharedAtoms'],
  minScore: 0,
  sampleSize: 20,
  limit: 10,
  skipSameTerm: true,
};

/**
 * The threshold a *bare* curried filter name resolves to. Naming `highConfidence`
 * with no number is the same as naming it with this one — a filter that silently
 * did nothing because it wanted a parameter was the failure mode this replaces.
 * Adding a curried filter without a default here is a type error, not a no-op.
 */
const CURRIED_FILTER_DEFAULTS = { highConfidence: 0.7 } as const;

type CurriedFilterName = keyof typeof CURRIED_FILTER_DEFAULTS;

// Computed once: `resolveFilters`/`resolveScorer` run per sampled concept per
// cycle, and these only ever reach an error message.
const known = (registry: object): string => Object.keys(registry).sort().join(', ');

const noSuch = (kind: string, name: string, candidates: string) =>
  new ConfigurationError(`premise config: no ${kind} named '${name}' (available: ${candidates})`);

const FILTER_NAMES = known(PREMISE_FILTER_REGISTRY);
const SCORER_NAMES = known(PREMISE_SCORER_REGISTRY);

function resolveFilters(filters: FilterSpec[]): PremiseFilter[] {
  const candidates = FILTER_NAMES;
  return filters.map((spec) => {
    if (typeof spec === 'object')
      return PREMISE_FILTER_REGISTRY.highConfidence.create(spec.highConfidence);
    const entry = PREMISE_FILTER_REGISTRY[spec as keyof typeof PREMISE_FILTER_REGISTRY];
    if (!entry) throw noSuch('filter', spec, candidates);
    if (!entry.isCurried) return entry.create();
    return entry.create(CURRIED_FILTER_DEFAULTS[spec as CurriedFilterName]);
  });
}

/**
 * The scorer for a sample config, or `undefined` when the caller asked for none.
 *
 * A name that is *present but unresolvable* throws rather than degrading: an
 * unknown scorer used to yield `undefined`, which `samplePremisesFromConfig`
 * turned into an empty premise set — a strategy that silently stopped
 * contributing. `linear` is curried and has no bare spelling, so naming it
 * without weights is a mistake worth reporting.
 */
export function resolveScorer(
  memory: MemoryView,
  scorer: SampleConfig['scorer']
): PremiseScorer | undefined {
  if (!scorer) return undefined;
  const candidates = SCORER_NAMES;
  if (typeof scorer === 'string') {
    const entry = PREMISE_SCORER_REGISTRY[scorer as keyof typeof PREMISE_SCORER_REGISTRY];
    if (!entry) throw noSuch('scorer', scorer, candidates);
    if (entry.isExtended) throw noSuch('bare scorer (use its weighted form)', scorer, candidates);
    return entry.create(memory);
  }
  if ('linear' in scorer) {
    // linear.create returns (memory) => PremiseScorer factory, call it with memory
    return PREMISE_SCORER_REGISTRY.linear.create(memory, scorer.linear)(memory);
  }
  throw noSuch('scorer', JSON.stringify(scorer), candidates);
}

/** Strongest claim per canonical term — the shared dedup behind composite premise/sampling unions. */
export const keepStrongestByTerm = <T extends { term: Term }>(
  candidates: readonly T[],
  scoreOf: (item: T) => number
): T[] => {
  const strongest = new TermMap<T>();
  for (const candidate of candidates) {
    const held = strongest.get(candidate.term);
    if (!held || scoreOf(candidate) > scoreOf(held)) strongest.set(candidate.term, candidate);
  }
  return [...strongest.values()];
};

/** The config merged over {@link PREMISE_SAMPLE_FALLBACK}, with its filters already bound. */
interface ResolvedPipeline {
  readonly config: ResolvedSampleConfig;
  readonly filters: readonly PremiseFilter[];
}

/**
 * Merged config and bound filters per config object.
 *
 * `samplePremisesFromConfig` runs once per sampled concept per inference cycle,
 * and every one of those calls was re-merging the config and re-currying the
 * filter registry to produce closures that depend on nothing but the config.
 * Keyed on identity, so a caller that rebuilds its config per call still pays
 * per call — see `createStrategy`, which hoists the one it controls.
 */
const PIPELINES = new WeakMap<SampleConfig, ResolvedPipeline>();

const resolvePipeline = (config: SampleConfig): ResolvedPipeline =>
  getOrInsert(PIPELINES, config, () => {
    const merged: ResolvedSampleConfig = { ...PREMISE_SAMPLE_FALLBACK, ...config };
    return { config: merged, filters: resolveFilters(merged.filters) };
  });

export function samplePremisesFromConfig(
  memory: MemoryView,
  task: Task,
  config: SampleConfig
): Task[] {
  const results: Task[] = [];
  const { config: merged, filters } = resolvePipeline(config);

  const sourceFn = PREMISE_SOURCES[merged.source];
  if (!sourceFn) return results;

  const scorerFn = resolveScorer(memory, merged.scorer);
  if (!scorerFn) return results;

  // One recall for the whole scored set, not one per concept.
  const strengthIndex =
    merged.scorer === 'edgeWeight'
      ? strengthIndexFor(memory, GRAPH_MEMORY, task.term, merged.sampleSize)
      : null;

  // Score, filter and collect in one pass: the three chained array stages this
  // replaced each materialized the surviving concepts again, and the sort
  // copied them a fourth time.
  const scored: Array<{ concept: Concept; score: number }> = [];
  for (const concept of sourceFn(task, memory, merged.sampleSize)) {
    const score = strengthIndex ? (strengthIndex.get(concept.term) ?? 0) : scorerFn(task, concept);
    if (score < merged.minScore) continue;
    if (merged.skipSameTerm && termsEqual(concept.term, task.term)) continue;
    if (merged.where && !merged.where(task, concept)) continue;
    let admitted = true;
    for (const filter of filters) admitted = admitted && filter(task, concept);
    if (!admitted) continue;
    scored.push({ concept, score });
  }
  scored.sort((a, b) => b.score - a.score);

  return collectUpTo(scored, merged.limit, ({ concept }) => {
    const belief = concept.topBelief();
    if (!belief || (merged.whereTruth && !merged.whereTruth(task, belief.truth))) {
      return undefined;
    }
    return createSecondaryTask(concept.term, concept.priority, belief.truth);
  });
}
