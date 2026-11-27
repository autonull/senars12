/**
 * Semantic Fold — concept management and semantic memory operations.
 */
import { termKey } from '../../terms';
import { Concept } from '../concept';
import { Focus } from '../focus';
import { Archive } from '../lifecycle';
import { MemoryIndex } from '../memory-index';
import { LinkManager } from '../links/LinkManager';
/** Semantic view over concepts. */
export class SemanticFold {
    #concepts = new Map();
    #focus;
    #archive;
    #index;
    #linkManager;
    #config;
    #clock;
    constructor(concepts, config, options) {
        this.#concepts = concepts;
        this.#config = config;
        this.#clock = options?.clock ?? (() => Date.now());
        this.#focus = new Focus({
            maxConcepts: config.focusMaxConcepts,
        });
        this.#archive = new Archive({
            maxArchivedConcepts: config.archiveMaxConcepts,
        });
        this.#linkManager = new LinkManager({
            defaultCapacity: config.linkCapacity,
            layers: { term: config.termLinkCapacity },
            forgetPolicy: config.linkForgetPolicy,
            globalDecayRate: config.linkDecayRate,
            rng: config.bag.rng,
            clock: config.bag.clock,
        });
        if (config.enableEmbeddingLayer) {
            const embeddingLayer = new EmbeddingLayer({
                capacity: config.semanticLinkCapacity,
                similarityThreshold: 0.8, // LINK.SEMANTIC_MIN_SIMILARITY
                maxLinksPerConcept: 20,
                generator: config.embeddingGenerator ?? new MockEmbeddingGenerator(),
            });
            this.#linkManager.setLayer('embedding', embeddingLayer);
        }
        this.#index = new MemoryIndex({
            enableAtomicIndex: config.enableIndexing,
            enableTemporalIndex: config.enableIndexing,
        });
        // Rebuild focus from current concepts
        this.#rebuildFocus();
    }
    /** Rebuild focus from current concepts. */
    #rebuildFocus() {
        this.#focus.clearFocus();
        const resident = [...this.#concepts.values()].filter((c) => !c.isArchived);
        const top = resident
            .sort((a, b) => b.concept.priority - a.concept.priority)
            .slice(0, this.#config.focusMaxConcepts);
        for (const c of top) {
            this.#focus.addToFocus(c.concept);
        }
    }
    /** Current number of resident (non-archived) concepts. */
    get size() {
        return [...this.#concepts.values()].filter((c) => !c.isArchived).length;
    }
    /** List all resident concepts. */
    listConcepts() {
        return [...this.#concepts.values()]
            .filter((c) => !c.isArchived)
            .map((c) => c.concept);
    }
    /** Iterate over resident concepts. */
    *conceptValues() {
        for (const c of this.#concepts.values()) {
            if (!c.isArchived)
                yield c.concept;
        }
    }
    /** Get a concept by term. */
    getConcept(term) {
        const key = termKey(term);
        return this.#concepts.get(key)?.concept;
    }
    /** Add a concept. */
    addConcept(term) {
        const key = termKey(term);
        let projection = this.#concepts.get(key);
        if (!projection) {
            const concept = new Concept(term, { bag: this.#config.bag });
            this.#index.index(concept, this.#clock());
            projection = { concept, lastSeen: this.#clock(), isArchived: false };
            this.#concepts.set(key, projection);
        }
        return projection.concept;
    }
    /** Remove a concept. */
    removeConcept(term) {
        const key = termKey(term);
        const projection = this.#concepts.get(key);
        if (!projection)
            return false;
        this.#concepts.delete(key);
        this.#index.remove(projection.concept);
        return true;
    }
    /** Archive a concept. */
    archiveConcept(concept) {
        const key = termKey(concept.term);
        const projection = this.#concepts.get(key);
        if (!projection || projection.isArchived) {
            return false;
        }
        projection.isArchived = true;
        this.#focus.removeFromFocus(concept);
        this.#archive.archive(concept);
        return true;
    }
    /** Clear all concepts. */
    clear() {
        this.#concepts.clear();
        this.#focus.clearFocus();
        this.#archive.clear();
        this.#linkManager.removeAllLinksForTerm({ op: 'atom', args: ['__ALL__'] });
        this.#index.clear();
    }
    /** Get focus concepts. */
    getFocusConcepts() {
        return this.#focus.getFocusSet();
    }
    /** Get focus instance. */
    getFocus() {
        return this.#focus;
    }
    /** Get archive instance. */
    getArchive() {
        return this.#archive;
    }
    /** Get link manager. */
    getLinkManager() {
        return this.#linkManager;
    }
    /** Get memory index. */
    getIndex() {
        return this.#index;
    }
    /** Query concepts by atomic symbol. */
    queryBySymbol(symbol) {
        return this.#index.getByAtomic(symbol);
    }
    /** Query concepts by time range. */
    queryByTimeRange(start, end) {
        return this.#index.getByTemporal([start, end]);
    }
    /** Find concepts matching pattern. */
    findConcepts(pattern, limit = 10) {
        return filterByTerm(this.listConcepts(), pattern, limit);
    }
    /** Find similar concepts. */
    findSimilarConcepts(term, limit = 10) {
        return selectSimilar(this.listConcepts(), term, limit);
    }
    /** Get related concepts via links. */
    getRelatedConcepts(term, limit = 10) {
        const key = termKey(term);
        const links = this.#linkManager.getLinks(term, { layer: 'term' });
        const related = [];
        for (const link of links) {
            const linkSourceKey = termKey(link.sourceTerm);
            const linkTargetKey = termKey(link.targetTerm);
            if (linkSourceKey === key || linkTargetKey === key) {
                const otherKey = linkSourceKey === key ? linkTargetKey : linkSourceKey;
                const targetConcept = this.#concepts.get(otherKey);
                if (targetConcept && !targetConcept.isArchived) {
                    related.push(targetConcept.concept);
                }
            }
            if (related.length >= limit)
                break;
        }
        return related;
    }
    /** Get top concepts by priority. */
    topConcepts(limit) {
        const resident = [...this.#concepts.values()].filter((c) => !c.isArchived);
        return resident
            .sort((a, b) => b.concept.priority - a.concept.priority)
            .slice(0, limit)
            .map((c) => c.concept);
    }
    /** Sample a window of concepts. */
    sampleWindow(windowSize, rng) {
        const resident = [...this.#concepts.values()].filter((c) => !c.isArchived);
        if (resident.length === 0)
            return [];
        const start = nextInt(rng, Math.max(1, resident.length - windowSize + 1));
        return resident.slice(start, start + windowSize).map((c) => c.concept);
    }
    /** Check health. */
    checkHealth() {
        const utilization = this.capacityPressure();
        return {
            isHealthy: utilization < 0.9, // PRESSURE.CRITICAL
            pressureLevel: utilization,
            consolidationNeeded: false,
            forgettingNeeded: utilization > 0.7, // PRESSURE.ARCHIVE
            recommendations: [],
        };
    }
    /** Compact memory. */
    compact() {
        // Apply forgetting
        // Would need forgetting instance
    }
    /** Get capacity pressure. */
    capacityPressure() {
        const totals = this.totals();
        const conceptPressure = totals.totalConcepts / this.#config.maxConcepts;
        const taskPressure = totals.totalTasks / this.#config.maxTasks;
        return Math.max(conceptPressure, taskPressure);
    }
    /** Get totals. */
    totals() {
        let totalConcepts = 0;
        let totalTasks = 0;
        for (const c of this.#concepts.values()) {
            if (!c.isArchived) {
                totalConcepts++;
                totalTasks += c.concept.totalTasks;
            }
        }
        return { totalConcepts, totalTasks };
    }
    /** Get statistics. */
    getStatistics() {
        const totals = this.totals();
        const pressure = this.pressureBreakdown();
        let lowPriority = 0, mediumPriority = 0, highPriority = 0;
        for (const c of this.#concepts.values()) {
            if (!c.isArchived) {
                const p = c.concept.priority;
                if (p < 0.33)
                    lowPriority++;
                else if (p < 0.66)
                    mediumPriority++;
                else
                    highPriority++;
            }
        }
        return {
            totalConcepts: totals.totalConcepts,
            totalTasks: totals.totalTasks,
            focusedConcepts: this.#focus.size,
            archivedConcepts: this.#archive.size,
            indexStats: this.#index.stats,
            archiveStats: this.#archive.stats,
            memoryPressure: pressure.capacity,
            utilization: pressure.capacity,
            pressureByBound: { concepts: pressure.concepts, tasks: pressure.tasks },
            conceptDistribution: { lowPriority, mediumPriority, highPriority },
        };
    }
    /** Get pressure breakdown. */
    pressureBreakdown() {
        const totals = this.totals();
        const conceptPressure = totals.totalConcepts / this.#config.maxConcepts;
        const taskPressure = totals.totalTasks / this.#config.maxTasks;
        return {
            concepts: conceptPressure,
            tasks: taskPressure,
            capacity: Math.max(conceptPressure, taskPressure),
        };
    }
    /** Get revision history for a term. */
    getRevisionHistory(_term) {
        // Would need revisions from episodic
        return [];
    }
    /** Find dense clusters. */
    findDenseClusters(_minStrength, _maxClusters) {
        return [];
    }
    /** Remove concepts matching pattern. */
    removeConceptsMatching(pattern) {
        const toRemove = this.listConcepts().filter((c) => c.term.toString().includes(pattern));
        let count = 0;
        for (const concept of toRemove) {
            if (this.removeConcept(concept.term))
                count++;
        }
        return count;
    }
    /** Get embedding index. */
    getEmbeddingIndex() {
        return this.#linkManager.getEmbeddingLayer();
    }
    /** Get associative memories. */
    getAssociativeMemories() {
        // Would need associative registry
        return null;
    }
}
// Type imports
import { nextInt } from '@senars/util/random';
import { EmbeddingLayer } from '../links/EmbeddingLayer';
import { MockEmbeddingGenerator } from '../embedding';
import { filterByTerm } from '../term-filter';
import { selectSimilar } from '../similarity';
