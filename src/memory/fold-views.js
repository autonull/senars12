/**
 * Fold-Derived Memory Views — materialized views of memory indexes derived from the event log.
 *
 * These replace the private stores of CausalIndex, ConceptGraph, Associative/EmbeddingLayer,
 * and EpisodeConsolidator with fold views that preserve every query surface.
 * Forgetting/archive → view eviction.
 */
import { atom, getArgs, termKey, fromNarsese } from '../terms/index';
import { cosineNormalized, normalize } from '../util/similarity';
/** Parse context strings to Terms, skipping invalid ones. */
function parseContext(context) {
    const terms = [];
    for (const s of context) {
        const term = fromNarsese(s);
        if (term)
            terms.push(term);
    }
    return terms;
}
/** Create a causal index fold view. */
export function createCausalIndexView(getLog) {
    let data = { byCauses: new Map(), byConsequences: new Map() };
    let version = 0;
    let lastUpdated = 0;
    let stale = true;
    const rebuild = () => {
        const log = getLog();
        data.byCauses.clear();
        data.byConsequences.clear();
        for (const episode of log) {
            for (const cause of episode.causes ?? []) {
                const arr = data.byCauses.get(cause) ?? [];
                arr.push(episode);
                data.byCauses.set(cause, arr);
            }
            for (const consequence of episode.consequences ?? []) {
                const arr = data.byConsequences.get(consequence) ?? [];
                arr.push(episode);
                data.byConsequences.set(consequence, arr);
            }
        }
        version++;
        lastUpdated = Date.now();
        stale = false;
    };
    return {
        name: 'CausalIndex',
        get version() { return version; },
        get lastUpdated() { return lastUpdated; },
        get stale() { return stale; },
        async refresh() { rebuild(); },
        evict() {
            data.byCauses.clear();
            data.byConsequences.clear();
            stale = true;
        },
        getData() { return data; },
        causedBy(id) { return data.byCauses.get(id) ?? []; },
        leadingTo(id) { return data.byConsequences.get(id) ?? []; },
    };
}
/** Create a concept graph fold view. */
export function createConceptGraphView(getLog, options = {}) {
    const { maxNodes = 10000, maxEdgesPerNode = 50, decayRate = 0.001, minEdgeWeight = 0.01 } = options;
    let data = {
        root: { term: atom('ROOT'), children: new Map(), coActivations: new Map(), activationCount: 0, lastActivated: 0 },
        nodeCount: 1,
        edgeCount: 0,
    };
    let version = 0;
    let lastUpdated = 0;
    let stale = true;
    const rebuild = () => {
        const log = getLog();
        data.root = { term: atom('ROOT'), children: new Map(), coActivations: new Map(), activationCount: 0, lastActivated: 0 };
        data.nodeCount = 1;
        data.edgeCount = 0;
        for (const episode of log) {
            // Extract terms from episode context (parse strings to Terms)
            const terms = parseContext(episode.context ?? []);
            for (let i = 0; i < terms.length; i++) {
                const term = terms[i];
                let node = data.root;
                const args = getArgs(term);
                for (const arg of args) {
                    const key = termKey(arg);
                    let child = node.children.get(key);
                    if (!child) {
                        if (data.nodeCount >= maxNodes)
                            break;
                        child = { term: arg, children: new Map(), coActivations: new Map(), activationCount: 0, lastActivated: 0 };
                        node.children.set(key, child);
                        data.nodeCount++;
                    }
                    node = child;
                }
                node.activationCount++;
                node.lastActivated = episode.timestamp;
                // Co-activation with next term
                if (i + 1 < terms.length) {
                    const coActive = terms[i + 1];
                    const coActiveKey = termKey(coActive);
                    let edge = node.coActivations.get(coActiveKey);
                    if (!edge) {
                        edge = { targetTerm: coActive, weight: 1, evidenceCount: 1, lastUpdated: episode.timestamp };
                        node.coActivations.set(coActiveKey, edge);
                        data.edgeCount++;
                    }
                    else {
                        edge.weight++;
                        edge.evidenceCount++;
                        edge.lastUpdated = episode.timestamp;
                    }
                }
            }
        }
        version++;
        lastUpdated = Date.now();
        stale = false;
    };
    return {
        name: 'ConceptGraph',
        get version() { return version; },
        get lastUpdated() { return lastUpdated; },
        get stale() { return stale; },
        async refresh() { await rebuild(); },
        evict() {
            data.root.children.clear();
            data.root.coActivations.clear();
            data.nodeCount = 1;
            data.edgeCount = 0;
            stale = true;
        },
        getData() { return data; },
        activate(term, coActiveWith) {
            let node = data.root;
            const args = getArgs(term);
            for (const arg of args) {
                const key = termKey(arg);
                let child = node.children.get(key);
                if (!child) {
                    if (data.nodeCount >= maxNodes)
                        return;
                    child = { term: arg, children: new Map(), coActivations: new Map(), activationCount: 0, lastActivated: 0 };
                    node.children.set(key, child);
                    data.nodeCount++;
                }
                node = child;
            }
            node.activationCount++;
            node.lastActivated = Date.now();
            if (coActiveWith) {
                const coActiveKey = termKey(coActiveWith);
                let edge = node.coActivations.get(coActiveKey);
                if (!edge) {
                    edge = { targetTerm: coActiveWith, weight: 1, evidenceCount: 1, lastUpdated: Date.now() };
                    node.coActivations.set(coActiveKey, edge);
                    data.edgeCount++;
                }
                else {
                    edge.weight++;
                    edge.evidenceCount++;
                    edge.lastUpdated = Date.now();
                }
            }
        },
        getCoActivations(term, limit = 10) {
            let node = data.root;
            const args = getArgs(term);
            for (const arg of args) {
                const key = termKey(arg);
                node = node.children.get(key);
                if (!node)
                    return [];
            }
            const edges = [...node.coActivations.values()]
                .filter(e => e.weight >= minEdgeWeight)
                .sort((a, b) => b.weight - a.weight)
                .slice(0, limit);
            return edges;
        },
        getActivationCount(term) {
            let node = data.root;
            const args = getArgs(term);
            for (const arg of args) {
                const key = termKey(arg);
                node = node.children.get(key);
                if (!node)
                    return 0;
            }
            return node.activationCount;
        },
        decayAll(rate) {
            const decay = (node) => {
                node.activationCount *= (1 - rate);
                for (const child of node.children.values()) {
                    decay(child);
                }
            };
            decay(data.root);
        },
    };
}
/** Create an associative memory fold view. */
export function createAssociativeMemoryView(getLog) {
    let data = { links: new Map() };
    let version = 0;
    let lastUpdated = 0;
    let stale = true;
    const rebuild = () => {
        const log = getLog();
        data.links.clear();
        for (const episode of log) {
            const terms = parseContext(episode.context ?? []);
            for (let i = 0; i < terms.length - 1; i++) {
                const from = terms[i];
                const to = terms[i + 1];
                const fromKey = termKey(from);
                const toKey = termKey(to);
                if (!fromKey || !toKey)
                    continue;
                const fromLinks = data.links.get(fromKey) ?? new Map();
                fromLinks.set(toKey, { target: to, strength: 1.0, type: 'temporal' });
                data.links.set(fromKey, fromLinks);
            }
        }
        version++;
        lastUpdated = Date.now();
        stale = false;
    };
    return {
        name: 'AssociativeMemory',
        get version() { return version; },
        get lastUpdated() { return lastUpdated; },
        get stale() { return stale; },
        async refresh() { rebuild(); },
        evict() {
            data.links.clear();
            stale = true;
        },
        getData() { return data; },
        recall(term, { limit = 10, minStrength = 0 } = {}) {
            const key = termKey(term);
            if (!key)
                return [];
            const links = data.links.get(key);
            if (!links)
                return [];
            return [...links.values()]
                .filter(l => l.strength >= minStrength)
                .sort((a, b) => b.strength - a.strength)
                .slice(0, limit)
                .map(l => ({ term: l.target, strength: l.strength }));
        },
        associate(from, to, { strength = 1.0 } = {}) {
            const fromKey = termKey(from);
            const toKey = termKey(to);
            if (!fromKey || !toKey)
                return false;
            const fromLinks = data.links.get(fromKey) ?? new Map();
            fromLinks.set(toKey, { target: to, strength, type: 'associative' });
            data.links.set(fromKey, fromLinks);
            return true;
        },
    };
}
/** Create an embedding layer fold view. */
export function createEmbeddingLayerView(getLog, generator // EmbeddingGenerator
) {
    let data = { embeddings: new Map(), generator };
    let version = 0;
    let lastUpdated = 0;
    let stale = true;
    const rebuild = async () => {
        const log = getLog();
        data.embeddings.clear();
        // Index all unique terms from log
        const uniqueTerms = new Map();
        for (const episode of log) {
            const terms = parseContext(episode.context ?? []);
            for (const term of terms) {
                const key = termKey(term);
                if (key && !uniqueTerms.has(key)) {
                    uniqueTerms.set(key, term);
                }
            }
        }
        // Generate embeddings in batches
        for (const term of uniqueTerms.values()) {
            await indexConceptInternal(term);
        }
        version++;
        lastUpdated = Date.now();
        stale = false;
    };
    const indexConceptInternal = async (term) => {
        const key = termKey(term);
        if (!key)
            return;
        const embedding = await data.generator.generate(term.toString());
        data.embeddings.set(key, { term, embedding });
    };
    return {
        name: 'EmbeddingLayer',
        get version() { return version; },
        get lastUpdated() { return lastUpdated; },
        get stale() { return stale; },
        async refresh() { await rebuild(); },
        evict() {
            data.embeddings.clear();
            stale = true;
        },
        getData() { return data; },
        async indexConcept(term) {
            await indexConceptInternal(term);
            version++;
            lastUpdated = Date.now();
        },
        async findSimilarTerms(queryTerm, topK = 10) {
            const queryEmbedding = await data.generator.generate(queryTerm.toString());
            const query = normalize(queryEmbedding);
            const results = [];
            const queryKey = termKey(queryTerm);
            for (const [key, indexed] of data.embeddings) {
                if (key === queryKey)
                    continue;
                const similarity = cosineNormalized(query, indexed.embedding);
                results.push({ term: indexed.term, similarity });
            }
            return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
        },
        similarity(termA, termB) {
            const keyA = termKey(termA);
            const keyB = termKey(termB);
            if (!keyA || !keyB)
                return 0;
            const embA = data.embeddings.get(keyA)?.embedding;
            const embB = data.embeddings.get(keyB)?.embedding;
            if (!embA || !embB)
                return 0;
            return cosineNormalized(normalize(embA), embB);
        },
    };
}
/** Create an episode consolidator fold view. */
export function createEpisodeConsolidatorView(getLog) {
    let data = { candidates: [], emittedSummaries: [] };
    let version = 0;
    let lastUpdated = 0;
    let stale = true;
    const rebuild = () => {
        const log = getLog();
        data.candidates = log
            .filter(e => !data.emittedSummaries.some(s => s.id === e.id)) // Skip already consolidated
            .map(e => ({ id: e.id ?? `ep-${e.timestamp}-${Math.random().toString(36).slice(2)}`, priority: calculateEpisodePriority(e), episode: e }))
            .sort((a, b) => b.priority - a.priority);
        version++;
        lastUpdated = Date.now();
        stale = false;
    };
    return {
        name: 'EpisodeConsolidator',
        get version() { return version; },
        get lastUpdated() { return lastUpdated; },
        get stale() { return stale; },
        async refresh() { rebuild(); },
        evict() {
            data.candidates = [];
            data.emittedSummaries = [];
            stale = true;
        },
        getData() { return data; },
        getCandidates() { return data.candidates; },
        async consolidate(budget = 8) {
            const candidates = data.candidates.slice(0, budget);
            const results = [];
            // Group by type and context similarity
            const groups = new Map();
            for (const c of candidates) {
                const key = `${c.episode.type}:${JSON.stringify(c.episode.context?.slice(0, 3))}`;
                const g = groups.get(key) ?? [];
                g.push(c);
                groups.set(key, g);
            }
            for (const [, group] of groups) {
                if (group.length < 2)
                    continue; // Only consolidate groups
                const summary = mergeEpisodes(group.map(g => g.episode));
                results.push({
                    summary,
                    merged: group.map(g => g.id),
                    scanned: group.length,
                });
                data.emittedSummaries.push(summary);
                // Remove merged from candidates
                for (const g of group) {
                    const idx = data.candidates.findIndex(c => c.id === g.id);
                    if (idx >= 0)
                        data.candidates.splice(idx, 1);
                }
            }
            version++;
            lastUpdated = Date.now();
            return results;
        },
    };
}
function calculateEpisodePriority(episode) {
    const SALIENCE = {
        reaction: 1.0,
        error: 0.9,
        dialogue: 0.8,
        question: 0.6,
        belief_added: 0.5,
        input: 0.5,
        response: 0.5,
        tool_call: 0.4,
    };
    const salience = SALIENCE[episode.type] ?? 0.5;
    const causal = (episode.causes?.length ?? 0) + (episode.consequences?.length ?? 0) + (episode.context?.length ?? 0);
    const intrinsic = salience * (1 + causal);
    const ageHours = (Date.now() - episode.timestamp) / 3_600_000;
    const recency = 1 / (1 + ageHours / 168); // softFalloff approximation
    return intrinsic * recency;
}
function mergeEpisodes(episodes) {
    const first = episodes[0];
    return {
        id: `summary-${first.id}-${Date.now()}`,
        type: 'belief_added',
        content: `Summary of ${episodes.length} episodes`,
        timestamp: Date.now(),
        context: episodes.flatMap(e => e.context ?? []).slice(0, 20),
        causes: episodes.flatMap(e => e.causes ?? []),
        consequences: episodes.flatMap(e => e.consequences ?? []),
        metadata: { kind: 'summary', mergedCount: episodes.length },
    };
}
/** Factory for creating analyzer fold views with shared boilerplate. */
function createAnalyzer(name, initialData, rebuild, emptyData, getLog) {
    let data = initialData;
    let version = 0;
    let lastUpdated = 0;
    let stale = true;
    const doRebuild = () => {
        rebuild(data, getLog());
        version++;
        lastUpdated = Date.now();
        stale = false;
    };
    return {
        name,
        get version() { return version; },
        get lastUpdated() { return lastUpdated; },
        get stale() { return stale; },
        async refresh() { doRebuild(); },
        evict() { data = initialData; stale = true; },
        getData() { return data; },
        analyzeEpisode() { return emptyData; },
        getAggregated() { return data; },
    };
}
/** All analyzer definitions — single source of truth for analyzer views. */
const ANALYZER_DEFS = [
    {
        name: 'CapabilitiesAnalyzer',
        initialData: { capabilityUsage: new Map(), coverage: 0 },
        emptyData: { capabilityUsage: new Map(), coverage: 0 },
        rebuild: (data, log) => {
            data.capabilityUsage.clear();
            let totalCapabilities = 0;
            for (const episode of log) {
                const caps = episode.metadata?.capabilities ?? [];
                for (const cap of caps) {
                    data.capabilityUsage.set(cap, (data.capabilityUsage.get(cap) ?? 0) + 1);
                }
                totalCapabilities += caps.length;
            }
            data.coverage = totalCapabilities > 0 ? totalCapabilities / log.length : 0;
        },
    },
    {
        name: 'ConstantsAnalyzer',
        initialData: { constantValues: new Map() },
        emptyData: { constantValues: new Map() },
        rebuild: (data, log) => {
            data.constantValues.clear();
            for (const episode of log) {
                const constants = episode.metadata?.constants ?? {};
                for (const [key, value] of Object.entries(constants)) {
                    const entry = data.constantValues.get(key) ?? { value, count: 0 };
                    entry.count++;
                    data.constantValues.set(key, entry);
                }
            }
        },
    },
    {
        name: 'CorrectionsAnalyzer',
        initialData: { corrections: [] },
        emptyData: { corrections: [] },
        rebuild: (data, log) => {
            data.corrections = [];
            for (const episode of log) {
                const correction = episode.metadata?.correction;
                if (correction)
                    data.corrections.push(correction);
            }
        },
    },
    {
        name: 'PerformanceAnalyzer',
        initialData: { metrics: new Map() },
        emptyData: { metrics: new Map() },
        rebuild: (data, log) => {
            data.metrics.clear();
            for (const episode of log) {
                const metrics = episode.metadata ?? {};
                for (const [key, value] of Object.entries(metrics)) {
                    const entry = data.metrics.get(key) ?? { mean: 0, count: 0 };
                    entry.mean = (entry.mean * entry.count + value) / (entry.count + 1);
                    entry.count++;
                    data.metrics.set(key, entry);
                }
            }
        },
    },
    {
        name: 'QualityAnalyzer',
        initialData: { qualityScores: [], meanQuality: 0 },
        emptyData: { qualityScores: [], meanQuality: 0 },
        rebuild: (data, log) => {
            data.qualityScores = log.map(e => e.metadata?.quality ?? 0).filter(q => q > 0);
            data.meanQuality = data.qualityScores.length > 0 ? data.qualityScores.reduce((a, b) => a + b, 0) / data.qualityScores.length : 0;
        },
    },
    {
        name: 'ReasoningPatternsAnalyzer',
        initialData: { patterns: new Map() },
        emptyData: { patterns: new Map() },
        rebuild: (data, log) => {
            data.patterns.clear();
            for (const episode of log) {
                const pattern = episode.metadata?.reasoningPattern;
                if (pattern)
                    data.patterns.set(pattern, (data.patterns.get(pattern) ?? 0) + 1);
            }
        },
    },
    {
        name: 'ResourcesAnalyzer',
        initialData: { resourceUsage: new Map() },
        emptyData: { resourceUsage: new Map() },
        rebuild: (data, log) => {
            data.resourceUsage.clear();
            for (const episode of log) {
                const resources = episode.metadata?.resources ?? {};
                for (const [key, value] of Object.entries(resources)) {
                    const entry = data.resourceUsage.get(key) ?? { mean: 0, peak: 0, count: 0 };
                    entry.mean = (entry.mean * entry.count + value) / (entry.count + 1);
                    entry.peak = Math.max(entry.peak, value);
                    entry.count++;
                    data.resourceUsage.set(key, entry);
                }
            }
        },
    },
    {
        name: 'TermPatternsAnalyzer',
        initialData: { termFrequency: new Map(), coOccurrence: new Map() },
        emptyData: { termFrequency: new Map(), coOccurrence: new Map() },
        rebuild: (data, log) => {
            data.termFrequency.clear();
            data.coOccurrence.clear();
            for (const episode of log) {
                const terms = episode.context?.map(t => t.toString()) ?? [];
                for (const term of terms) {
                    data.termFrequency.set(term, (data.termFrequency.get(term) ?? 0) + 1);
                }
                for (let i = 0; i < terms.length - 1; i++) {
                    const co = data.coOccurrence.get(terms[i]) ?? new Map();
                    co.set(terms[i + 1], (co.get(terms[i + 1]) ?? 0) + 1);
                    data.coOccurrence.set(terms[i], co);
                }
            }
        },
    },
];
export const createCapabilitiesAnalyzerView = (getLog) => createAnalyzer(ANALYZER_DEFS[0].name, ANALYZER_DEFS[0].initialData, ANALYZER_DEFS[0].rebuild, ANALYZER_DEFS[0].emptyData, getLog);
export const createConstantsAnalyzerView = (getLog) => createAnalyzer(ANALYZER_DEFS[1].name, ANALYZER_DEFS[1].initialData, ANALYZER_DEFS[1].rebuild, ANALYZER_DEFS[1].emptyData, getLog);
export const createCorrectionsAnalyzerView = (getLog) => createAnalyzer(ANALYZER_DEFS[2].name, ANALYZER_DEFS[2].initialData, ANALYZER_DEFS[2].rebuild, ANALYZER_DEFS[2].emptyData, getLog);
export const createPerformanceAnalyzerView = (getLog) => createAnalyzer(ANALYZER_DEFS[3].name, ANALYZER_DEFS[3].initialData, ANALYZER_DEFS[3].rebuild, ANALYZER_DEFS[3].emptyData, getLog);
export const createQualityAnalyzerView = (getLog) => createAnalyzer(ANALYZER_DEFS[4].name, ANALYZER_DEFS[4].initialData, ANALYZER_DEFS[4].rebuild, ANALYZER_DEFS[4].emptyData, getLog);
export const createReasoningPatternsAnalyzerView = (getLog) => createAnalyzer(ANALYZER_DEFS[5].name, ANALYZER_DEFS[5].initialData, ANALYZER_DEFS[5].rebuild, ANALYZER_DEFS[5].emptyData, getLog);
export const createResourcesAnalyzerView = (getLog) => createAnalyzer(ANALYZER_DEFS[6].name, ANALYZER_DEFS[6].initialData, ANALYZER_DEFS[6].rebuild, ANALYZER_DEFS[6].emptyData, getLog);
export const createTermPatternsAnalyzerView = (getLog) => createAnalyzer(ANALYZER_DEFS[7].name, ANALYZER_DEFS[7].initialData, ANALYZER_DEFS[7].rebuild, ANALYZER_DEFS[7].emptyData, getLog);
/** Registry of all fold views using KeyedRegistry. */
import { KeyedRegistry } from '../util/keyed-collection';
import { SenarsError } from '../errors/senars-error';
/** Registry of all fold views using KeyedRegistry. */
export class FoldViewRegistry {
    views;
    constructor() {
        this.views = new KeyedRegistry({
            keyOf: (v) => v.name,
            onDuplicate: (name) => { throw new SenarsError(`Fold view '${name}' already registered`, 'VALIDATION_ERROR', { name }); },
        });
    }
    /** Register a fold view. */
    register(view) {
        this.views.register(view);
    }
    /** Get a fold view by name. */
    get(name) {
        return this.views.get(name);
    }
    /** Get all registered view names. */
    getNames() {
        return this.views.keys();
    }
    /** Get all registered views. */
    getAll() {
        return this.views.all();
    }
    /** Refresh all views. */
    async refreshAll() {
        await Promise.all(this.views.all().map((v) => v.refresh()));
    }
    /** Evict all views (forgetting). */
    evictAll() {
        for (const view of this.views.all()) {
            view.evict();
        }
    }
    /** Clear all registrations. */
    clear() {
        this.views.clear();
    }
}
/** Create a complete fold view registry with all standard views. */
/** Map analyzer name to its creator function. */
const ANALYZER_CREATORS = {
    CapabilitiesAnalyzer: createCapabilitiesAnalyzerView,
    ConstantsAnalyzer: createConstantsAnalyzerView,
    CorrectionsAnalyzer: createCorrectionsAnalyzerView,
    PerformanceAnalyzer: createPerformanceAnalyzerView,
    QualityAnalyzer: createQualityAnalyzerView,
    ReasoningPatternsAnalyzer: createReasoningPatternsAnalyzerView,
    ResourcesAnalyzer: createResourcesAnalyzerView,
    TermPatternsAnalyzer: createTermPatternsAnalyzerView,
};
export function createFoldViewRegistry(getLog, embeddingGenerator) {
    const registry = new FoldViewRegistry();
    registry.register(createCausalIndexView(getLog));
    registry.register(createConceptGraphView(getLog));
    registry.register(createAssociativeMemoryView(getLog));
    registry.register(createEmbeddingLayerView(getLog, embeddingGenerator));
    registry.register(createEpisodeConsolidatorView(getLog));
    // Register all analyzer views from the single source of truth
    for (const def of ANALYZER_DEFS) {
        const creator = ANALYZER_CREATORS[def.name];
        if (creator)
            registry.register(creator(getLog));
    }
    return registry;
}
/** Refresh all views. */
export async function refreshAllViews(registry) {
    await registry.refreshAll();
}
/** Evict all views (forgetting). */
export function evictAllViews(registry) {
    registry.evictAll();
}
