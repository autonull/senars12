/**
 * Fold Memory — pure projections over the episodic log.
 *
 * The episodic log is the single source of truth; this class provides
 * the same public API but as read-only projections with mutations
 * becoming log appends (fire-and-forget).
 *
 * Projections:
 * - semantic: resident concepts derived from belief_added/revision episodes
 * - procedural: task bags derived from task admission episodes
 * - episodic: log replay and link/revision/archive projections
 */
import { termKey, } from '../../terms';
import { DEFAULT_MEMORY_CONFIG } from '../config';
import { Focus } from '../focus';
import { SemanticFold } from './semantic';
import { ProceduralFold } from './procedural';
import { buildProjectionsFromLog, logConceptAdded, logTaskAdmitted, logConceptRemoved, logConceptArchived, logLinkAdded, logLinkRemoved, logConsolidation, logEviction, rebuildFocus, } from './episodic';
/** Fold Memory — pure projections over the episodic log. */
export class FoldMemory {
    /** D17: bounded revision log capacity. */
    static REVISION_LOG_CAP = 1000;
    #log;
    #config;
    #clock;
    #semantic;
    #procedural;
    #revisions = [];
    #archiveLog = [];
    #lastProjectionTs = 0;
    #projectionsBuilt = false;
    #cyclesSinceConsolidation = 0;
    /** Pending log appends (fire-and-forget). */
    #pendingAppends = [];
    constructor(log, config = DEFAULT_MEMORY_CONFIG, options) {
        this.#log = log;
        this.#config = { ...DEFAULT_MEMORY_CONFIG, ...config };
        this.#clock = options?.clock ?? (() => Date.now());
        // Build initial projections from log (async, non-blocking)
        this.#buildProjectionsFromLog().catch(() => {
            // Ignore errors during initial build
        });
    }
    /** Build projections from the log. */
    async #buildProjectionsFromLog() {
        const episodes = await this.#log.getEpisodes({ limit: 10000 });
        const { concepts, tasks, links, revisions, archiveLog } = buildProjectionsFromLog(episodes, this.#config);
        this.#semantic = new SemanticFold(concepts, this.#config, { clock: this.#clock });
        this.#procedural = new ProceduralFold(tasks, concepts, this.#clock);
        this.#revisions = revisions;
        this.#archiveLog = archiveLog;
        this.#projectionsBuilt = true;
        this.#lastProjectionTs = this.#clock();
    }
    /** Ensure projections are built (called by read methods). */
    #ensureProjections() {
        if (!this.#projectionsBuilt) {
            this.#buildProjectionsFromLog().catch(() => { });
        }
    }
    /** Queue a log append (fire-and-forget). */
    #queueAppend(appendFn) {
        this.#pendingAppends.push(appendFn);
        this.#processPendingAppends();
    }
    /** Process pending log appends. */
    async #processPendingAppends() {
        while (this.#pendingAppends.length > 0) {
            const append = this.#pendingAppends.shift();
            try {
                await append();
            }
            catch {
                // Ignore log append errors
            }
        }
    }
    // ============================================================================
    // MemoryPorts implementation - delegate to semantic/procedural folds
    // ============================================================================
    get attentionModel() {
        const focus = this.#semantic?.getFocus();
        if (!focus) {
            // Return a minimal AttentionModel implementation
            return {
                prime: () => 0,
                decay: () => 0,
                tick: () => { },
                metadata: { name: 'fallback', description: 'Fallback attention model' },
            };
        }
        // This is a hack - need proper attention model
        return focus;
    }
    setAttentionModel(model) {
        // Would need to store attention model
    }
    /** Current number of resident (non-archived) concepts. */
    get size() {
        this.#ensureProjections();
        if (!this.#semantic)
            return 0;
        return this.#semantic.size;
    }
    // --- ConceptReader ---
    listConcepts() {
        this.#ensureProjections();
        if (!this.#semantic)
            return [];
        return this.#semantic.listConcepts();
    }
    *conceptValues() {
        this.#ensureProjections();
        if (!this.#semantic)
            return;
        yield* this.#semantic.conceptValues();
    }
    getConcept(term) {
        this.#ensureProjections();
        if (!this.#semantic)
            return undefined;
        return this.#semantic.getConcept(term);
    }
    // --- ConceptWriter ---
    addConcept(term) {
        this.#ensureProjections();
        if (!this.#semantic)
            throw new Error('Semantic fold not initialized');
        const concept = this.#semantic.addConcept(term);
        this.#queueAppend(logConceptAdded(this.#log, term));
        return concept;
    }
    removeConcept(term) {
        this.#ensureProjections();
        if (!this.#semantic)
            return false;
        const existed = this.#semantic.removeConcept(term);
        if (existed) {
            this.#queueAppend(logConceptRemoved(this.#log, term));
        }
        return existed;
    }
    archiveConcept(concept) {
        this.#ensureProjections();
        if (!this.#semantic)
            return false;
        const result = this.#semantic.archiveConcept(concept);
        if (result) {
            this.#queueAppend(logConceptArchived(this.#log, concept.term));
        }
        return result;
    }
    clear() {
        this.#ensureProjections();
        if (!this.#semantic)
            return;
        this.#semantic.clear();
        this.#procedural = new ProceduralFold(new Map(), new Map(), this.#clock);
        this.#revisions = [];
        this.#archiveLog = [];
    }
    // --- TaskAdmission ---
    addTask(term, type, truth, budget, stamp) {
        this.#ensureProjections();
        if (!this.#semantic || !this.#procedural)
            return false;
        const concept = this.#semantic.addConcept(term);
        const result = this.#procedural.addTask(term, type, truth, budget, stamp);
        if (result) {
            this.#queueAppend(logTaskAdmitted(this.#log, term, type, truth, budget, stamp));
        }
        return result;
    }
    // --- BeliefTable ---
    beliefs(concept) {
        if (!this.#procedural)
            return [];
        return this.#procedural.beliefs(concept);
    }
    taskCount(concept) {
        if (!this.#procedural)
            return 0;
        return this.#procedural.taskCount(concept);
    }
    // --- GoalEnumeration ---
    getGoals() {
        this.#ensureProjections();
        if (!this.#procedural)
            return [];
        return this.#procedural.getGoals();
    }
    // --- Belief/Question Enumeration ---
    getBeliefs() {
        this.#ensureProjections();
        if (!this.#procedural)
            return [];
        return this.#procedural.getBeliefs();
    }
    getQuestions() {
        this.#ensureProjections();
        if (!this.#procedural)
            return [];
        return this.#procedural.getQuestions();
    }
    // --- StatisticsView ---
    stats() {
        return this.getStatistics();
    }
    capacityPressure() {
        if (!this.#semantic)
            return 0;
        return this.#semantic.capacityPressure();
    }
    pressureBreakdown() {
        if (!this.#semantic)
            return { concepts: 0, tasks: 0, capacity: 0 };
        return this.#semantic.pressureBreakdown();
    }
    totals() {
        if (!this.#semantic)
            return { totalConcepts: 0, totalTasks: 0 };
        return this.#semantic.totals();
    }
    getStatistics() {
        if (!this.#semantic)
            return { totalConcepts: 0, totalTasks: 0, focusedConcepts: 0, archivedConcepts: 0, memoryPressure: 0, utilization: 0, pressureByBound: { concepts: 0, tasks: 0 }, conceptDistribution: { lowPriority: 0, mediumPriority: 0, highPriority: 0 } };
        return this.#semantic.getStatistics();
    }
    // --- SymbolIndex ---
    queryBySymbol(symbol) {
        this.#ensureProjections();
        if (!this.#semantic)
            return [];
        return this.#semantic.queryBySymbol(symbol);
    }
    queryByTimeRange(start, end) {
        this.#ensureProjections();
        if (!this.#semantic)
            return [];
        return this.#semantic.queryByTimeRange(start, end);
    }
    findConcepts(pattern, limit = 10) {
        this.#ensureProjections();
        if (!this.#semantic)
            return [];
        return this.#semantic.findConcepts(pattern, limit);
    }
    findSimilarConcepts(term, limit = 10) {
        this.#ensureProjections();
        if (!this.#semantic)
            return [];
        return this.#semantic.findSimilarConcepts(term, limit);
    }
    getRelatedConcepts(term, limit = 10) {
        this.#ensureProjections();
        if (!this.#semantic)
            return [];
        return this.#semantic.getRelatedConcepts(term, limit);
    }
    // --- LinkPort ---
    links() {
        if (!this.#semantic)
            throw new Error('Semantic fold not initialized');
        return this.#semantic.getLinkManager();
    }
    attachConceptGraph(graph) {
        if (!this.#semantic)
            return graph;
        this.#semantic.getLinkManager().setLayer('graph', graph);
        return graph;
    }
    getLinks(sourceTerm, options) {
        if (!this.#semantic)
            return [];
        return this.#semantic.getLinkManager().getLinks(sourceTerm, options);
    }
    getLinkPriority(sourceTerm, targetTerm, layerName = 'term') {
        this.#ensureProjections();
        if (!this.#semantic)
            return 0;
        return this.#semantic.getLinkManager().getLinkPriority(sourceTerm, targetTerm, layerName);
    }
    addLink(sourceTerm, targetTerm, options) {
        this.#ensureProjections();
        if (!this.#semantic)
            return null;
        const layer = options?.layer ?? 'term';
        const priority = options?.priority ?? 1.0;
        const entry = this.#semantic.getLinkManager().addLink(sourceTerm, targetTerm, { layer, priority });
        if (!entry)
            return null;
        this.#queueAppend(logLinkAdded(this.#log, sourceTerm, targetTerm, layer, priority));
        return {
            source: termKey(sourceTerm),
            target: termKey(targetTerm),
            layer,
            priority,
            lastUpdated: this.#clock(),
        };
    }
    removeByTerm(sourceTerm, targetTerm, type) {
        this.#ensureProjections();
        if (!this.#semantic)
            return false;
        const layer = 'term';
        const removed = this.#semantic.getLinkManager().removeByTerm(sourceTerm, targetTerm, type);
        if (removed) {
            this.#queueAppend(logLinkRemoved(this.#log, sourceTerm, targetTerm, layer));
        }
        return removed;
    }
    removeAllLinksForTerm(term) {
        if (!this.#semantic)
            return;
        this.#semantic.getLinkManager().removeAllLinksForTerm(term);
    }
    getLayer(name) {
        if (!this.#semantic)
            return undefined;
        return this.#semantic.getLinkManager().getLayer(name);
    }
    setLayer(name, layer) {
        if (!this.#semantic)
            return;
        this.#semantic.getLinkManager().setLayer(name, layer);
    }
    applyDecay(decayRate) {
        if (!this.#semantic)
            return;
        this.#semantic.getLinkManager().applyDecay(decayRate);
    }
    // --- MemoryClock ---
    consolidate(opts) {
        const cycles = opts?.cycleCount ?? 1;
        this.#cyclesSinceConsolidation += cycles;
        if (this.#cyclesSinceConsolidation >= this.#config.consolidationInterval) {
            this.#cyclesSinceConsolidation = 0;
            if (!this.#semantic)
                return;
            this.#semantic.getLinkManager().applyDecay();
            this.#applyForgetting();
            this.#semantic.getFocus().clearFocus();
            rebuildFocus(this.#semantic.getFocus(), this.#semantic.concepts, this.#config.focusMaxConcepts);
            this.#queueAppend(logConsolidation(this.#log, cycles));
        }
    }
    // --- MemoryView methods ---
    topConcepts(limit) {
        this.#ensureProjections();
        if (!this.#semantic)
            return [];
        return this.#semantic.topConcepts(limit);
    }
    sampleWindow(windowSize, rng) {
        this.#ensureProjections();
        if (!this.#semantic)
            return [];
        return this.#semantic.sampleWindow(windowSize, rng);
    }
    // --- Additional Memory methods ---
    getEmbeddingIndex() {
        if (!this.#semantic)
            return {};
        return this.#semantic.getEmbeddingIndex();
    }
    getAssociativeMemories() {
        if (!this.#semantic)
            return {};
        return this.#semantic.getAssociativeMemories();
    }
    getLinkManager() {
        if (!this.#semantic)
            throw new Error('Semantic fold not initialized');
        return this.#semantic.getLinkManager();
    }
    getFocusConcepts() {
        if (!this.#semantic)
            return [];
        return this.#semantic.getFocusConcepts();
    }
    getFocus() {
        if (!this.#semantic)
            return new Focus();
        return this.#semantic.getFocus();
    }
    getConfig() {
        return this.#config;
    }
    getMemoryPressure() {
        return this.capacityPressure();
    }
    getRevisionHistory(term) {
        this.#ensureProjections();
        const key = termKey(term);
        return this.#revisions.filter((r) => r.termKey === key);
    }
    findDenseClusters(minStrength, maxClusters) {
        if (!this.#semantic)
            return [];
        return this.#semantic.findDenseClusters(minStrength, maxClusters);
    }
    removeConceptsMatching(pattern) {
        this.#ensureProjections();
        if (!this.#semantic)
            return 0;
        return this.#semantic.removeConceptsMatching(pattern);
    }
    checkHealth() {
        if (!this.#semantic)
            return { isHealthy: true, pressureLevel: 0, consolidationNeeded: false, forgettingNeeded: false, recommendations: [] };
        return this.#semantic.checkHealth();
    }
    compact() {
        this.#applyForgetting();
    }
    evictionReport() {
        return undefined;
    }
    // --- Private helpers ---
    #applyForgetting() {
        if (!this.#semantic)
            return;
        const victim = this.#semantic.getLinkManager().selectVictim?.(this.listConcepts());
        if (victim) {
            this.removeConcept(victim.term);
            this.#queueAppend(logEviction(this.#log, 'forgetting'));
        }
    }
}
/** Create a FoldMemory instance. */
export function createFoldMemory(log, config, options) {
    return new FoldMemory(log, config, options);
}
