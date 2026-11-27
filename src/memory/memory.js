import { BoundedRing, getOrInsert, perPart, rankBy, selectTopN, shareOf, sortBy } from '@senars/util/collections';
import { nextInt } from '@senars/util/random';
import { LINK, PRESSURE } from '../constants';
import { NullAttentionModel } from '../strategies/attention/NullAttentionModel';
import { mentionsSymbol, Stamp, TermMap, TermSet, termKey, } from '../terms';
import { atom } from '../terms/impls/factory';
import { NEUTRAL_BUDGET } from '../types';
import { AssociativeRegistry, GraphMemory } from './associative';
import { Concept, taskFromBagItem, } from './concept';
import { DEFAULT_MEMORY_CONFIG } from './config';
import { MockEmbeddingGenerator } from './embedding';
import { Focus } from './focus';
import { Archive, Forgetting } from './lifecycle';
import { LinkManager } from './links/LinkManager';
import { EmbeddingLayer } from './links/EmbeddingLayer';
import { MemoryIndex } from './memory-index';
import { evictUnderPressure } from './pressure';
import { selectSimilar } from './similarity';
import { calculateConceptStats, storePressure, tallyConcepts } from './state';
import { filterByTerm } from './term-filter';
/** Stateless, so one instance serves every memory that was not given a model. */
const NULL_ATTENTION = new NullAttentionModel();
export class Memory {
    /** D17: bounded revision log capacity. */
    static REVISION_LOG_CAP = 1000;
    #attentionModel;
    concepts = new TermMap();
    associative;
    config;
    index;
    focus;
    archive;
    forgetting;
    linkManager;
    revisionLog = new BoundedRing(Memory.REVISION_LOG_CAP);
    lastRevisionTs = 0;
    cyclesSinceConsolidation = 0;
    /** The last eviction pass's report, including whether it could free anything. */
    lastEviction;
    /** Cached priority-sorted concepts for sampleWindow. */
    #sortedConceptsCache = null;
    /** Whether the sorted cache is dirty. */
    #sortedConceptsDirty = true;
    /** Cached resident entries for sweeps. */
    #residentEntriesCache = null;
    constructor(config = DEFAULT_MEMORY_CONFIG, options) {
        this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
        this.#attentionModel = options?.attentionModel ?? NULL_ATTENTION;
        this.index = new MemoryIndex({
            enableAtomicIndex: this.config.enableIndexing,
            enableTemporalIndex: this.config.enableIndexing,
        });
        this.focus = new Focus({
            maxConcepts: this.config.focusMaxConcepts,
        });
        this.archive = new Archive({
            maxArchivedConcepts: this.config.archiveMaxConcepts,
        });
        this.forgetting = new Forgetting(this.config.forgettingPolicy);
        this.linkManager = new LinkManager({
            defaultCapacity: this.config.linkCapacity,
            // One term-keyed layer; semantic similarity lives in the EmbeddingLayer
            // below, so a second term layer would only ever be an empty duplicate.
            layers: { term: this.config.termLinkCapacity },
            forgetPolicy: this.config.linkForgetPolicy,
            globalDecayRate: this.config.linkDecayRate,
            rng: this.config.bag.rng,
            clock: this.config.bag.clock,
        });
        // Every layer the manager owns is recallable by name; no second registry.
        this.associative = new AssociativeRegistry((name) => this.linkManager.getLayer(name));
        // Register EmbeddingLayer for semantic similarity (optional)
        if (config.enableEmbeddingLayer) {
            const embeddingLayer = new EmbeddingLayer({
                capacity: this.config.semanticLinkCapacity,
                similarityThreshold: LINK.SEMANTIC_MIN_SIMILARITY,
                maxLinksPerConcept: 20,
                generator: config.embeddingGenerator ?? new MockEmbeddingGenerator(),
            });
            this.linkManager.setLayer('embedding', embeddingLayer);
        }
    }
    getEmbeddingIndex() {
        return this.linkManager.getEmbeddingLayer();
    }
    getAssociativeMemories() {
        return this.associative;
    }
    /** Publish the co-activation graph as the `graph` associative memory, replacing any prior one. */
    attachConceptGraph(graph) {
        this.associative.register(new GraphMemory(graph));
        return graph;
    }
    get size() {
        return this.concepts.size;
    }
    getConcept(term) {
        return this.concepts.get(term);
    }
    getLinkManager() {
        return this.linkManager;
    }
    /** The link surface as a port, for consumers that need recall and nothing else. */
    links() {
        return this.linkManager;
    }
    beliefs(concept) {
        return concept.getBeliefs();
    }
    taskCount(concept) {
        return concept.totalTasks;
    }
    /**
     * The `attention` slot's live instance. Reading it is how the strategy layer
     * primes and decays; replacing it is how a reconfigure takes effect, which is
     * why it is a pair of accessors rather than a readonly field.
     */
    get attentionModel() {
        return this.#attentionModel;
    }
    setAttentionModel(model) {
        this.#attentionModel = model;
    }
    listConcepts() {
        return Array.from(this.concepts.values());
    }
    *conceptValues() {
        for (const concept of this.concepts.values()) {
            yield concept;
        }
    }
    forEachConcept(fn) {
        const concepts = this.residentEntries();
        for (let i = 0; i < concepts.length; i++)
            fn(concepts[i].value);
    }
    /**
     * The concept collection's entries, for a full sweep.
     *
     * Read straight off the entries rather than through `values()`: the term
     * collection's iterator is a general-purpose one that calls a projection
     * closure per element, and three full sweeps per inference cycle — decay,
     * sampling, relevance propagation — turned that into two indirect calls for
     * every resident concept, every cycle. An index and a field read is the floor
     * for a sweep. The array is live, so a sweep may not add or remove concepts;
     * the sweeps in this class only ever mutate the concepts themselves.
     */
    residentEntries() {
        if (this.#residentEntriesCache === null) {
            this.#residentEntriesCache = this.concepts.getEntries();
        }
        return this.#residentEntriesCache;
    }
    getFocusConcepts() {
        return this.focus.getFocusSet();
    }
    getFocus() {
        return this.focus;
    }
    /**
     * A pure read: the stored goals, as tasks.
     *
     * It used to mint `Stamp.createInput()` for any goal admitted without one,
     * so a second call returned a different stamp for the same goal and
     * `Stamp.overlaps` / `noStampOverlap` reasoned about an id that could never
     * repeat. Stamps are minted once at admission (`Concept.addTask`) and read
     * here, which makes two reads of one goal return the same identity
     * (TODO29.a §4 row 5).
     */
    getGoals() {
        const goals = [];
        for (const concept of this.concepts.values()) {
            for (const g of concept.goalBag.all()) {
                goals.push(taskFromBagItem(g, 'goal', concept.priority));
            }
        }
        return goals;
    }
    /**
     * A pure read: the stored beliefs, as tasks.
     */
    getBeliefs() {
        const beliefs = [];
        for (const concept of this.concepts.values()) {
            for (const b of concept.beliefBag.all()) {
                beliefs.push(taskFromBagItem(b, 'belief', concept.priority));
            }
        }
        return beliefs;
    }
    /**
     * A pure read: the stored questions, as tasks.
     */
    getQuestions() {
        const questions = [];
        for (const concept of this.concepts.values()) {
            for (const q of concept.questionBag.all()) {
                questions.push(taskFromBagItem(q, 'question', concept.priority));
            }
        }
        return questions;
    }
    /** Iterator over all beliefs without allocating an array. */
    *beliefTasks() {
        for (const concept of this.concepts.values()) {
            for (const b of concept.beliefBag.all()) {
                yield taskFromBagItem(b, 'belief', concept.priority);
            }
        }
    }
    /** Iterator over all goals without allocating an array. */
    *goalTasks() {
        for (const concept of this.concepts.values()) {
            for (const g of concept.goalBag.all()) {
                yield taskFromBagItem(g, 'goal', concept.priority);
            }
        }
    }
    /** Iterator over all questions without allocating an array. */
    *questionTasks() {
        for (const concept of this.concepts.values()) {
            for (const q of concept.questionBag.all()) {
                yield taskFromBagItem(q, 'question', concept.priority);
            }
        }
    }
    /**
     * Memory statistics.
     */
    stats() {
        return this.getStatistics();
    }
    getConfig() {
        return this.config;
    }
    getMemoryPressure() {
        return this.capacityPressure();
    }
    getRelatedConcepts(term, limit = 10) {
        const concept = this.concepts.get(term);
        if (!concept)
            return [];
        const results = this.linkManager
            .getLinks(term, { maxResults: limit })
            .map((link) => this.concepts.get(link.targetTerm))
            .filter((c) => !!c);
        if (results.length === 0)
            results.push(...this.findSimilarConcepts(term, limit));
        return results;
    }
    findConcepts(pattern, limit = 10) {
        return filterByTerm(this.concepts.values(), pattern, limit);
    }
    addConcept(term) {
        return getOrInsert(this.concepts, term, () => {
            if (this.concepts.size >= this.config.maxConcepts)
                this.applyForgetting();
            return this.adoptConcept(new Concept(term, {
                onRevision: (entry) => this.recordRevision(entry),
                bag: this.config.bag,
            }));
        });
    }
    /**
     * Make `concept` the live instance for its term. Adopting the instance rather
     * than rebuilding one is what lets an archived concept be restored with the
     * identity its links, tasks and revision history refer to.
     */
    adoptConcept(concept) {
        this.concepts.set(concept.term, concept);
        this.#invalidateSortedCache();
        if (this.config.enableIndexing)
            this.index.index(concept);
        const embeddingIndex = this.getEmbeddingIndex();
        embeddingIndex?.indexConcept(concept.term).catch(() => {
            // Fire-and-forget; embedding index failures are non-fatal
        });
        this.updateFocus(concept);
        return concept;
    }
    /** Invalidate the priority-sorted concept cache. */
    #invalidateSortedCache() {
        this.#sortedConceptsDirty = true;
        this.#sortedConceptsCache = null;
        this.#residentEntriesCache = null;
    }
    addTask(term, type, truth, budget = NEUTRAL_BUDGET, stamp) {
        const concept = this.addConcept(term);
        const createdStamp = stamp ?? Stamp.createInput();
        return concept.addTask(type, { term, truth, budget, stamp: createdStamp });
    }
    getRevisionHistory(term) {
        const key = termKey(term);
        return rankBy(this.revisionLog.filter((entry) => entry.termKey === key), (entry) => entry.timestamp);
    }
    removeConcept(term) {
        const concept = this.concepts.get(term);
        if (concept) {
            this.focus.removeFromFocus(concept);
            if (this.config.enableIndexing)
                this.index.remove(concept);
            this.linkManager.removeAllLinksForTerm(term);
            this.concepts.delete(term);
            this.#invalidateSortedCache();
            return true;
        }
        return false;
    }
    /**
     * The `n` highest-attention resident concepts: attention order, which is what
     * `topK` means to every consumer.
     *
     * This used to rank by `MemoryScorer.scoreForRetrieval`, a four-factor score
     * whose novelty and relevance had no signals at any call site and whose
     * recency was a literal `1` — so the score was a constant plus a scaled
     * priority, and the ranking was attention order wearing an indirection. What
     * replaced it is deliberately free of the clock: a ranking that read
     * `lastAccessedAt` would make two stores built in the same millisecond order
     * differently, which is the determinism invariant the scorer cannot have
     * (TODO29.a §4 row 3, §5.4).
     */
    topConcepts(n) {
        // Over `values()` rather than `residentEntries()`: this is the default premise
        // source, called once per sampled concept per cycle, and the entry array is
        // only ever scanned — never indexed or kept. A sweep that walks the result
        // more than once still wants `residentEntries()`.
        return selectTopN(this.concepts.values(), n, (concept) => concept.priority);
    }
    /**
     * A random contiguous window of the priority-sorted store — the windowed-roulette
     * strategy's positional-local diversity.
     *
     * The window is taken from the whole sorted store rather than from `topConcepts`,
     * which returns *at most* `windowSize` concepts and so made the window the whole
     * result: the start offset was computed from an array that could not be longer
     * than the window, and the strategy's defining property never fired.
     */
    sampleWindow(windowSize, rng) {
        if (windowSize <= 0)
            return [];
        const entries = this.residentEntries();
        const len = entries.length;
        if (len === 0)
            return [];
        if (len <= windowSize)
            return entries.map((e) => e.value);
        // Use cached priority-sorted array if available, otherwise build and cache it.
        let concepts = this.#sortedConceptsCache;
        if (this.#sortedConceptsDirty || concepts === null) {
            concepts = new Array(len);
            for (let i = 0; i < len; i++) {
                concepts[i] = entries[i].value;
            }
            concepts.sort((a, b) => b.priority - a.priority);
            this.#sortedConceptsCache = concepts;
            this.#sortedConceptsDirty = false;
        }
        const start = nextInt(rng, len - windowSize + 1);
        return concepts.slice(start, start + windowSize);
    }
    consolidate(opts) {
        const interval = this.config.consolidationInterval;
        if (++this.cyclesSinceConsolidation < interval)
            return;
        // The interval that actually elapsed, not a literal 1: `decay` takes the
        // cycles it is to deduct over, and consolidation on an interval of 10 is a
        // ten-cycle decay.
        const cyclesElapsed = perPart(this.cyclesSinceConsolidation, interval);
        this.cyclesSinceConsolidation = 0;
        this.attentionModel.tick(this, opts?.cycleCount ?? cyclesElapsed);
        const { linkDecayRate } = this.config;
        this.decayAll(cyclesElapsed);
        this.lastEviction = evictUnderPressure(this);
        this.linkManager.applyDecay(linkDecayRate);
        this.updateAllFocus();
    }
    findDenseClusters(minSize = 3, minLinkStrength = 0.5) {
        const clusters = [];
        const visited = new TermSet();
        this.forEachConcept((concept) => {
            if (visited.has(concept.term))
                return;
            const cluster = this.bfsCluster(concept, minLinkStrength, visited);
            if (cluster.length >= minSize) {
                clusters.push({
                    concepts: cluster,
                    hasAbstract: cluster.some((c) => mentionsSymbol(c.term, 'abstract') || mentionsSymbol(c.term, 'category')),
                });
            }
        });
        return clusters;
    }
    createAbstractConcept(name, sourceConcepts) {
        const abstractTerm = atom(name);
        const concept = this.addConcept(abstractTerm);
        for (const source of sourceConcepts) {
            this.linkManager.addLink(abstractTerm, source.term, { type: 'term-link', priority: 0.7 });
        }
        return concept;
    }
    removeConceptsMatching(pattern) {
        const toRemove = filterByTerm(this.listConcepts(), pattern);
        for (const concept of toRemove) {
            this.removeConcept(concept.term);
        }
        return toRemove.length;
    }
    /**
     * Archive a concept out of the live store. The store removal is the point:
     * an archive that leaves the concept resident does not relieve
     * `capacityPressure()`, so eviction runs again every cycle against a
     * population it has already shed, and `retrieveFromArchive` returns a concept
     * that is simultaneously archived and live.
     */
    archiveConcept(concept) {
        if (!this.config.enableArchive)
            return false;
        this.archive.archive(concept);
        return this.removeConcept(concept.term);
    }
    clear() {
        this.concepts.clear();
        this.focus.clearFocus();
        if (this.config.enableIndexing)
            this.index.clear();
        if (this.config.enableArchive)
            this.archive.clear();
        this.linkManager.applyDecay(1);
        this.#invalidateSortedCache();
    }
    /**
     * Pressure in `0..1`, the maximum of the store's own bounds rather than the
     * concept count alone (TODO29.a §5.8). {@link storePressure} owns the
     * derivation, so the eviction policy, the health report and the statistics
     * block cannot each read a different number for the same store.
     */
    capacityPressure() {
        return this.pressureBreakdown().capacity;
    }
    /** The two bounds behind {@link capacityPressure}, so a report names both. */
    pressureBreakdown() {
        return storePressure(this.totals(), this.config);
    }
    /** Totals without the tercile pass; what persistence serializes. */
    totals() {
        return tallyConcepts(this.concepts.values());
    }
    getStatistics() {
        const stats = calculateConceptStats(this.concepts.values());
        // One tally, not two: the bounds read the counts the pass above already
        // made rather than sweeping the store a second time to re-derive them.
        const { concepts, tasks, capacity: pressure } = storePressure(stats, this.config);
        const result = {
            totalConcepts: stats.totalConcepts,
            totalTasks: stats.totalTasks,
            focusedConcepts: this.focus.size,
            archivedConcepts: this.config.enableArchive ? this.archive.size : 0,
            memoryPressure: pressure,
            utilization: pressure,
            pressureByBound: { concepts, tasks },
            conceptDistribution: {
                lowPriority: stats.lowPriority,
                mediumPriority: stats.mediumPriority,
                highPriority: stats.highPriority,
            },
        };
        if (this.config.enableIndexing)
            result.indexStats = this.index.stats;
        if (this.config.enableArchive)
            result.archiveStats = this.archive.stats;
        return result;
    }
    setConfig(updates) {
        Object.assign(this.config, updates);
    }
    retrieveFromArchive(term) {
        if (!this.config.enableArchive)
            return undefined;
        const concept = this.archive.unarchive(term);
        return concept ? this.adoptConcept(concept) : undefined;
    }
    queryBySymbol(symbol) {
        if (!this.config.enableIndexing)
            return [];
        return this.index.getByAtomic(symbol);
    }
    queryByTimeRange(start, end) {
        if (!this.config.enableIndexing)
            return [];
        return this.index.getByTemporal([start, end]);
    }
    checkHealth() {
        return this.computeHealth();
    }
    compact() {
        const toRemove = sortBy(this.listConcepts().filter((c) => c.priority < 0.1 && c.totalTasks === 0), (c) => c.priority);
        toRemove.push(...this.findOrphanedLinks());
        // 10% of the store, not of the removal list: the two differ whenever the
        // list is the smaller pool, and shrinking the store is what bounds it.
        for (const concept of shareOf(toRemove, 0.1, 0, this.concepts.size)) {
            this.removeConcept(concept.term);
        }
        this.updateAllFocus();
    }
    mergeConcepts(concepts) {
        if (concepts.length < 2)
            return null;
        const primary = concepts[0];
        if (!primary)
            return null;
        const others = concepts.slice(1);
        for (const other of others) {
            if (!primary.canMergeWith(other, 0.85))
                return null;
        }
        return primary.mergeWith(others);
    }
    /**
     * The `limit` concepts most similar to `term`, ranked by `selectSimilar`.
     *
     * The candidate set is the whole store, as it has always been: the similarity
     * clusters this used to read were one cluster per distinct term, so
     * "searching the index" was walking every concept and scoring it. Nothing here
     * can narrow the search, so nothing here pretends to.
     */
    findSimilarConcepts(term, limit = 10) {
        return selectSimilar(this.concepts.values(), term, limit);
    }
    recordRevision(entry) {
        const ts = Math.max(entry.timestamp, this.lastRevisionTs + 1);
        this.lastRevisionTs = ts;
        // D17: bounded revision log (drop-oldest).
        this.revisionLog.push({ ...entry, timestamp: ts });
    }
    /**
     * The one decay sweep in the system, reached from {@link consolidate} and
     * nowhere else — so what a concept forgets is a function of elapsed
     * consolidation intervals rather than of how many times a sampler read the
     * store (TODO29.a §5.4). A concept already at zero stays there: its decay is
     * zero times the rate, so skipping it changes no value and saves the write.
     * Under pressure the tail of drained concepts is the majority of the
     * population.
     */
    decayAll(cyclesElapsed) {
        const rate = this.config.activationDecayRate;
        const concepts = this.residentEntries();
        for (let i = 0; i < concepts.length; i++) {
            const concept = concepts[i].value;
            if (concept.priority <= 0)
                continue;
            const decay = this.attentionModel.decay(concept, cyclesElapsed, rate);
            if (decay !== 0)
                concept.writeAttention({ reason: 'decay', amount: decay });
        }
        this.#invalidateSortedCache();
    }
    bfsCluster(start, minStrength, visited) {
        const cluster = [];
        const queue = [start];
        visited.add(start.term);
        while (queue.length > 0) {
            const current = queue.shift();
            cluster.push(current);
            const links = this.linkManager.getLinks(current.term);
            for (const link of links) {
                if (link.priority < minStrength)
                    continue;
                const target = this.concepts.get(link.targetTerm);
                if (!target)
                    continue;
                if (visited.has(target.term))
                    continue;
                visited.add(target.term);
                queue.push(target);
            }
        }
        return cluster;
    }
    applyForgetting() {
        const concept = this.forgetting.selectVictim(this.concepts.values());
        if (concept)
            this.removeConcept(concept.term);
    }
    updateFocus(concept) {
        this.focus.addToFocus(concept);
    }
    updateAllFocus() {
        this.focus.clearFocus();
        for (const concept of selectTopN(this.concepts.values(), this.config.focusMaxConcepts, (c) => c.priority)) {
            this.focus.addToFocus(concept);
        }
    }
    computeHealth() {
        const utilization = this.capacityPressure();
        const consolidationNeeded = this.cyclesSinceConsolidation >= this.config.consolidationInterval;
        return {
            isHealthy: utilization < PRESSURE.CRITICAL && !consolidationNeeded,
            pressureLevel: utilization,
            consolidationNeeded,
            forgettingNeeded: utilization > PRESSURE.ARCHIVE,
            recommendations: [],
        };
    }
    /**
     * What the last eviction pass did. A pass that freed nothing reports
     * `reason: 'exhausted'` — a store at capacity whose policy provably could not
     * act is a condition an operator has to be able to see, and returning
     * `{ archived: 0, forgotten: 0 }` made it indistinguishable from a pass that
     * found nothing wrong (TODO29.a §5.8).
     */
    evictionReport() {
        return this.lastEviction;
    }
    /** Resident concepts holding at least one link to a term that is no longer stored. */
    findOrphanedLinks() {
        return [...this.concepts.values()].filter((concept) => this.linkManager.getLinks(concept.term).some((link) => !this.concepts.has(link.targetTerm)));
    }
}
export { deserialize, repair, serialize, validate, } from './state/serialization';
