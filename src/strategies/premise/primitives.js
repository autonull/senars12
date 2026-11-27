import { collectUpTo, getOrInsert } from '@senars/util/collections';
import { GRAPH_MEMORY } from '../../memory/associative';
import { LINK_LAYER } from '../../memory/links/types';
import { getArgs, sharesSymbol, Stamp, TermMap, termsEqual } from '../../terms';
import { ConfigurationError, createSecondaryTask } from '../../types';
/** Concepts reached through an associative memory, in that memory's strength order. */
const conceptsFrom = (memory, name, term, limit) => {
    const concepts = [];
    for (const hit of memory.getAssociativeMemories().recall(name, term, { limit })) {
        const concept = memory.getConcept(hit.term);
        if (concept)
            concepts.push(concept);
    }
    return concepts;
};
/** Recall depth for a standalone per-concept strength lookup. */
const LOOKUP_LIMIT = 20;
/** Association strength one memory assigns to a specific target term. */
const strengthOf = (memory, name, from, to) => memory
    .getAssociativeMemories()
    .recall(name, from, { limit: LOOKUP_LIMIT })
    .find((hit) => termsEqual(hit.term, to))?.strength ?? 0;
/** One recall for the whole scored set, keyed by the canonical structural identity of the target. */
const strengthIndexFor = (memory, name, from, size) => {
    const hits = memory.getAssociativeMemories().recall(name, from, { limit: size });
    if (hits.length === 0)
        return null;
    const index = new TermMap();
    for (const hit of hits)
        index.set(hit.term, hit.strength);
    return index;
};
export const PREMISE_SOURCES = {
    bag: (task, memory, n = 10) => memory.topConcepts(n),
    concepts: (task, memory) => memory.listConcepts(),
    links: (task, memory, n = 20) => conceptsFrom(memory, LINK_LAYER.TERM, task.term, n),
    taskArgs: (task, memory) => {
        const args = task.term.kind === 'conjunction' ? getArgs(task.term) : [];
        return args.map((arg) => memory.getConcept(arg)).filter((c) => !!c);
    },
    graph: (task, memory, n = 20) => conceptsFrom(memory, GRAPH_MEMORY, task.term, n),
};
function getLinkStrength(memory, primary, target) {
    return memory.links().getLinkPriority(primary, target);
}
function createScorerRegistry() {
    const registry = {
        // Simple scorers (no memory dependency)
        priority: {
            create: (_memory) => (_task, concept) => concept.priority,
            isExtended: false,
        },
        // Curried scorers (need memory)
        linkWeight: {
            create: (memory) => (task, concept) => getLinkStrength(memory, task.term, concept.term),
            isExtended: false,
        },
        edgeWeight: {
            create: (memory) => (task, concept) => strengthOf(memory, GRAPH_MEMORY, task.term, concept.term),
            isExtended: false,
        },
        // Extended scorers (parameterized factories)
        linear: {
            create: (_memory, weights) => {
                return (memory) => (task, concept) => {
                    const linkStrength = getLinkStrength(memory, task.term, concept.term);
                    const embeddingIndex = memory.getEmbeddingIndex?.();
                    const embeddingSim = embeddingIndex?.similarity?.(task.term, concept.term) ?? 0;
                    return (weights.link * linkStrength +
                        weights.embed * embeddingSim +
                        weights.pri * concept.priority);
                };
            },
            isExtended: true,
        },
    };
    return registry;
}
export const PREMISE_SCORER_REGISTRY = createScorerRegistry();
function createFilterRegistry() {
    const registry = {
        sharedAtoms: {
            create: () => (task, concept) => sharesSymbol(task.term, concept.term),
            isCurried: false,
        },
        noStampOverlap: {
            create: () => (task, concept) => {
                const belief = concept.topBelief();
                if (!belief?.stamp)
                    return true;
                const taskStamp = task.stamp;
                if (!taskStamp)
                    return true;
                return !Stamp.overlaps(belief.stamp, taskStamp);
            },
            isCurried: false,
        },
        inheritanceOnly: {
            create: () => (_task, concept) => concept.term.kind === 'inheritance',
            isCurried: false,
        },
        inheritanceOverlap: {
            create: () => (task, concept) => {
                if (task.term.kind !== 'inheritance' || concept.term.kind !== 'inheritance')
                    return true;
                const [taskSub, taskPred] = getArgs(task.term);
                const [conceptSub, conceptPred] = getArgs(concept.term);
                return ((taskSub !== undefined &&
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
                        termsEqual(taskPred, conceptPred)));
            },
            isCurried: false,
        },
        // Curried filter with parameter
        highConfidence: {
            create: (threshold) => (task, concept) => {
                const belief = concept.topBelief();
                return (belief?.truth?.f ?? 0) > threshold;
            },
            isCurried: true,
        },
    };
    return registry;
}
export const PREMISE_FILTER_REGISTRY = createFilterRegistry();
/**
 * The sampling pipeline a primitive inherits when it declares no value of its
 * own. The configuration schema's defaults read from here, so the table, the
 * singletons and a user config all resolve to the same pipeline.
 */
export const PREMISE_SAMPLE_FALLBACK = {
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
const CURRIED_FILTER_DEFAULTS = { highConfidence: 0.7 };
// Computed once: `resolveFilters`/`resolveScorer` run per sampled concept per
// cycle, and these only ever reach an error message.
const known = (registry) => Object.keys(registry).sort().join(', ');
const noSuch = (kind, name, candidates) => new ConfigurationError(`premise config: no ${kind} named '${name}' (available: ${candidates})`);
const FILTER_NAMES = known(PREMISE_FILTER_REGISTRY);
const SCORER_NAMES = known(PREMISE_SCORER_REGISTRY);
function resolveFilters(filters) {
    const candidates = FILTER_NAMES;
    return filters.map((spec) => {
        if (typeof spec === 'object')
            return PREMISE_FILTER_REGISTRY.highConfidence.create(spec.highConfidence);
        const entry = PREMISE_FILTER_REGISTRY[spec];
        if (!entry)
            throw noSuch('filter', spec, candidates);
        if (!entry.isCurried)
            return entry.create();
        return entry.create(CURRIED_FILTER_DEFAULTS[spec]);
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
export function resolveScorer(memory, scorer) {
    if (!scorer)
        return undefined;
    const candidates = SCORER_NAMES;
    if (typeof scorer === 'string') {
        const entry = PREMISE_SCORER_REGISTRY[scorer];
        if (!entry)
            throw noSuch('scorer', scorer, candidates);
        if (entry.isExtended)
            throw noSuch('bare scorer (use its weighted form)', scorer, candidates);
        return entry.create(memory);
    }
    if ('linear' in scorer) {
        // linear.create returns (memory) => PremiseScorer factory, call it with memory
        return PREMISE_SCORER_REGISTRY.linear.create(memory, scorer.linear)(memory);
    }
    throw noSuch('scorer', JSON.stringify(scorer), candidates);
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
const PIPELINES = new WeakMap();
const resolvePipeline = (config) => getOrInsert(PIPELINES, config, () => {
    const merged = { ...PREMISE_SAMPLE_FALLBACK, ...config };
    return { config: merged, filters: resolveFilters(merged.filters) };
});
export function samplePremisesFromConfig(memory, task, config) {
    const results = [];
    const { config: merged, filters } = resolvePipeline(config);
    const sourceFn = PREMISE_SOURCES[merged.source];
    if (!sourceFn)
        return results;
    const scorerFn = resolveScorer(memory, merged.scorer);
    if (!scorerFn)
        return results;
    // One recall for the whole scored set, not one per concept.
    const strengthIndex = merged.scorer === 'edgeWeight'
        ? strengthIndexFor(memory, GRAPH_MEMORY, task.term, merged.sampleSize)
        : null;
    // Score, filter and collect in one pass: the three chained array stages this
    // replaced each materialized the surviving concepts again, and the sort
    // copied them a fourth time.
    const scored = [];
    for (const concept of sourceFn(task, memory, merged.sampleSize)) {
        const score = strengthIndex ? (strengthIndex.get(concept.term) ?? 0) : scorerFn(task, concept);
        if (score < merged.minScore)
            continue;
        if (merged.skipSameTerm && termsEqual(concept.term, task.term))
            continue;
        if (merged.where && !merged.where(task, concept))
            continue;
        let admitted = true;
        for (const filter of filters)
            admitted = admitted && filter(task, concept);
        if (!admitted)
            continue;
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
