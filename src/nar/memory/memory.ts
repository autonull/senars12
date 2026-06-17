import {Concept, type ConceptMergeResult, type ConceptTaskType} from './concept.js';
import type {Term, Truth} from '../terms';
import {Stamp, calculateSimilarity, TermMap} from '../terms';
import type {Budget, Task} from '../types';
import {NEUTRAL_BUDGET} from '../types/core.js';
import {MemoryIndex} from './memory-index.js';
import {Focus} from './focus.js';
import {Archive} from './lifecycle/archive.js';
import {MemoryScorer} from './pressure/scorer.js';
import {MemoryConsolidation} from './pressure/consolidation.js';
import type {ForgettingPolicy} from './lifecycle/forgetting.js';
import {Forgetting} from './lifecycle/forgetting.js';
import {LinkManager} from './links';
import {LINK} from '../constants.js';

import type {MemoryHealth} from './health.js';
import {calculateConceptStats} from './state/statistics.js';
import type {AttentionModel} from '../strategies/types.js';
import {SimpleAttention} from '../strategies/attention/index.js';

export interface MemoryConfig {
    maxConcepts?: number;
    activationDecayRate?: number;
    consolidationInterval?: number;
    focusMaxConcepts?: number;
    archiveMaxConcepts?: number;
    enableIndexing?: boolean;
    enableArchive?: boolean;
    forgettingPolicy?: ForgettingPolicy;
    healthCheckInterval?: number;
    enablePressureDetection?: boolean;
    linkCapacity?: number;
    termLinkCapacity?: number;
    semanticLinkCapacity?: number;
    linkForgetPolicy?: 'priority' | 'lru' | 'fifo' | 'random';
    linkDecayRate?: number;
}

const DEFAULT_CONFIG: Required<MemoryConfig> = {
    maxConcepts: 1000,
    activationDecayRate: 0.01,
    consolidationInterval: 10,
    focusMaxConcepts: 50,
    archiveMaxConcepts: 1000,
    enableIndexing: true,
    enableArchive: true,
    forgettingPolicy: 'fifo',
    healthCheckInterval: 1000,
    enablePressureDetection: true,
    linkCapacity: 1000,
    termLinkCapacity: 1000,
    semanticLinkCapacity: 500,
    linkForgetPolicy: 'priority',
    linkDecayRate: 0.001,
};

export interface MemoryStatistics {
    totalConcepts: number;
    totalTasks: number;
    focusedConcepts: number;
    archivedConcepts: number;
    indexStats?: { atomic: number; temporal: number; activation: number };
    archiveStats?: { size: number; capacity: number; utilization: number };
    memoryPressure: number;
    utilization: number;
    conceptDistribution: { lowPriority: number; mediumPriority: number; highPriority: number };
}

export class Memory {
    readonly attentionModel: AttentionModel;
    private readonly concepts = new TermMap<Concept>();
    private readonly config: Required<MemoryConfig>;
    private readonly index: MemoryIndex;
    private readonly focus: Focus;
    private readonly archive: Archive;
    private readonly scorer: MemoryScorer;
    private readonly consolidation: MemoryConsolidation;
    private readonly forgetting: Forgetting;
    private readonly linkManager: LinkManager;
    private cyclesSinceConsolidation = 0;
    private lastTimestamp = Date.now();
    private readonly healthCheckInterval: number;
    private lastHealthCheck = 0;
    private pressureLevel = 0;

    constructor(config: MemoryConfig = DEFAULT_CONFIG, options?: {
        attentionModel?: AttentionModel;
    }) {
        this.config = {...DEFAULT_CONFIG, ...config};
        this.healthCheckInterval = this.config.healthCheckInterval;
        this.attentionModel = options?.attentionModel ?? new SimpleAttention();

        this.index = new MemoryIndex({
            enableAtomicIndex: this.config.enableIndexing,
            enableTemporalIndex: this.config.enableIndexing,
            enableActivationIndex: true,
        });
        this.focus = new Focus({
            maxConcepts: this.config.focusMaxConcepts,
        });
        this.archive = new Archive({
            maxArchivedConcepts: this.config.archiveMaxConcepts,
        });
        this.scorer = new MemoryScorer();
        this.consolidation = new MemoryConsolidation();
        this.forgetting = new Forgetting(this.config.forgettingPolicy);
        this.linkManager = new LinkManager({
            defaultCapacity: config.linkCapacity ?? LINK.DEFAULT_CAPACITY,
            layers: {
                term: config.termLinkCapacity ?? LINK.TERM_LAYER_CAPACITY,
                semantic: config.semanticLinkCapacity ?? LINK.SEMANTIC_LAYER_CAPACITY,
            },
            forgetPolicy: config.linkForgetPolicy ?? LINK.FORGET_POLICY,
            globalDecayRate: config.linkDecayRate ?? LINK.DECAY_RATE,
        });
    }

    get size(): number {
        return this.concepts.size;
    }

    getConcept(term: Term): Concept | undefined {
        return this.concepts.get(term);
    }

    getLinkManager(): LinkManager {
        return this.linkManager;
    }

    listConcepts(): Concept[] {
        return Array.from(this.concepts.values());
    }

    getFocusConcepts(): Concept[] {
        return this.focus.getFocusSet();
    }

    getFocus(): Focus {
        return this.focus;
    }

    getGoals(): Task[] {
        const goals: Task[] = [];
        for (const concept of this.concepts.values()) {
            for (const g of concept.goalBag.toArray()) {
                goals.push({
                    term: g.term,
                    type: 'goal',
                    truth: g.truth,
                    budget: g.budget,
                    stamp: g.stamp,
                    occurrenceTime: g.occurrenceTime ?? 0,
                    derived: g.derived ?? false
                } as Task);
            }
        }
        return goals;
    }

    getConfig(): MemoryConfig {
        return this.config;
    }

    getMemoryPressure(): number {
        return this.pressureLevel;
    }

    getRelatedConcepts(term: Term, limit = 10): Concept[] {
        const concept = this.concepts.get(term);
        if (!concept) return [];

        const results = this.linkManager
            .getLinks(term)
            .slice(0, limit)
            .map((link) => this.concepts.get(link.targetTerm))
            .filter((c): c is Concept => !!c);

        if (results.length === 0) results.push(...this.findSimilarConcepts(term, limit));
        return results.slice(0, limit);
    }

    findConcepts(pattern: string, limit: number = 10): Concept[] {
        const patternLower = pattern.toLowerCase();
        const results: Concept[] = [];
        for (const concept of this.concepts.values()) {
            if (concept.term.toString().toLowerCase().includes(patternLower)) {
                results.push(concept);
                if (results.length >= limit) break;
            }
        }
        return results;
    }

    addConcept(term: Term): Concept {
        const existing = this.concepts.get(term);
        if (existing) return existing;

        if (this.concepts.size >= this.config.maxConcepts) this.applyForgetting();

        const concept = new Concept(term);
        this.concepts.set(term, concept);

        if (this.config.enableIndexing) this.index.index(concept, this.lastTimestamp);
        this.updateFocus(concept);
        return concept;
    }

    addTask(term: Term, type: ConceptTaskType, truth?: Truth, budget: Budget = NEUTRAL_BUDGET, stamp?: Stamp): boolean {
        const concept = this.getConcept(term) ?? this.addConcept(term);
        return concept.addTask(type, {term, truth, budget, stamp: stamp ?? Stamp.createInput()});
    }

    removeConcept(term: Term): boolean {
        const concept = this.concepts.get(term);
        if (concept) {
            this.focus.removeFromFocus(concept);
            if (this.config.enableIndexing) this.index.remove(concept);
            this.linkManager.removeAllLinksForTerm(term);
            this.concepts.delete(term);
            return true;
        }
        return false;
    }

    sample(limit: number): Concept[] {
        for (const concept of this.concepts.values()) {
            const decay = this.attentionModel.decay(concept, 1, this.config.activationDecayRate);
            if (decay !== 0) concept.priority = Math.max(0, concept.priority - decay);
        }
        return [...this.concepts.values()]
            .sort((a, b) => this.scorer.scoreForRetrieval(b) - this.scorer.scoreForRetrieval(a))
            .slice(0, limit);
    }

    consolidate(opts?: { lm?: { generateObject: (opts: { prompt: string; schema: unknown }) => Promise<{ object: { name: string; definition: string } }> }; cycleCount?: number }): void {
        if (++this.cyclesSinceConsolidation < this.config.consolidationInterval) return;
        this.cyclesSinceConsolidation = 0;

        this.attentionModel.tick(this, opts?.cycleCount ?? this.cyclesSinceConsolidation);

        const { activationDecayRate, linkDecayRate, maxConcepts } = this.config;

        for (const concept of this.concepts.values()) {
            concept.decay(activationDecayRate);
        }

        const capacityPressure = this.concepts.size / maxConcepts;
        if (capacityPressure > 0.8) {
            const candidates = [...this.concepts.values()].filter(c => c.totalTasks === 0);
            candidates.sort((a, b) => a.priority - b.priority);
            const toArchiveCount = Math.ceil(candidates.length * Math.min(0.3, capacityPressure - 0.5));
            const toRemoveCount = capacityPressure > 0.9 
                ? Math.ceil(candidates.length * Math.min(0.2, capacityPressure - 0.8)) 
                : 0;
            
            for (let i = 0; i < toArchiveCount && i < candidates.length; i++) {
                this.archiveConcept(candidates[i]!);
            }
            for (let i = toArchiveCount; i < toArchiveCount + toRemoveCount && i < candidates.length; i++) {
                this.removeConcept(candidates[i]!.term);
            }
        }
        this.linkManager.applyDecay(linkDecayRate);
        this.updateAllFocus();

        if (opts?.lm) {
            this.lmAssistedConsolidate(opts.lm);
        }
    }

    private async lmAssistedConsolidate(lm: { generateObject: (opts: { prompt: string; schema: unknown }) => Promise<{ object: { name: string; definition: string } }> }): Promise<void> {
        const clusters = this.findDenseClusters();
        for (const cluster of clusters) {
            if (cluster.concepts.length >= 3 && !cluster.hasAbstract) {
                try {
                    const conceptNames = cluster.concepts.map(c => c.term.toString());
                    const result = await lm.generateObject({
                        prompt: `Abstract category for: ${conceptNames.join(', ')}?`,
                        schema: { type: 'object', properties: { name: { type: 'string' }, definition: { type: 'string' } } },
                    });
                    this.createAbstractConcept(result.object.name, cluster.concepts);
                } catch {
                    // LM abstraction failed, continue without it
                }
            }
        }
    }

    findDenseClusters(minSize = 3, minLinkStrength = 0.5): Array<{ concepts: Concept[]; hasAbstract: boolean }> {
        const clusters: Array<{ concepts: Concept[]; hasAbstract: boolean }> = [];
        const visited = new Set<string>();
        const allConcepts = this.listConcepts();

        for (const concept of allConcepts) {
            const key = concept.term.toString();
            if (visited.has(key)) continue;

            const cluster = this.bfsCluster(concept, minLinkStrength, visited);
            if (cluster.length >= minSize) {
                clusters.push({
                    concepts: cluster,
                    hasAbstract: cluster.some(c => c.term.toString().includes('abstract') || c.term.toString().includes('category')),
                });
            }
        }

        return clusters;
    }

    private bfsCluster(start: Concept, minStrength: number, visited: Set<string>): Concept[] {
        const cluster: Concept[] = [];
        const queue: Concept[] = [start];
        const startKey = start.term.toString();
        visited.add(startKey);

        while (queue.length > 0) {
            const current = queue.shift()!;
            cluster.push(current);

            const links = this.linkManager.getLinks(current.term);
            for (const link of links) {
                if (link.priority < minStrength) continue;
                const target = this.concepts.get(link.targetTerm);
                if (!target) continue;
                const targetKey = target.term.toString();
                if (visited.has(targetKey)) continue;

                visited.add(targetKey);
                queue.push(target);
            }
        }

        return cluster;
    }

    createAbstractConcept(name: string, sourceConcepts: Concept[]): Concept {
        const { atom } = require('../terms/factory.js');
        const abstractTerm = atom(name);
        const concept = this.addConcept(abstractTerm);

        for (const source of sourceConcepts) {
            this.linkManager.addLink(abstractTerm, source.term, { type: 'term-link', priority: 0.7 });
        }

        return concept;
    }

    removeConceptsMatching(pattern: string): number {
        const patternLower = pattern.toLowerCase();
        const toRemove = this.listConcepts().filter(c =>
            c.term.toString().toLowerCase().includes(patternLower),
        );
        for (const concept of toRemove) {
            this.removeConcept(concept.term);
        }
        return toRemove.length;
    }

    archiveConcept(concept: Concept): boolean {
        if (!this.config.enableArchive) return false;
        this.archive.archive(concept);
        this.index.remove(concept);
        return true;
    }

    clear(): void {
        this.concepts.clear();
        this.focus.clearFocus();
        if (this.config.enableIndexing) this.index.clear();
        if (this.config.enableArchive) this.archive.clear();
        this.linkManager.applyDecay(1);
    }

    getStatistics(): MemoryStatistics {
        const stats = calculateConceptStats(this.concepts.values());
        const result: MemoryStatistics = {
            totalConcepts: stats.totalConcepts,
            totalTasks: stats.totalTasks,
            focusedConcepts: this.focus.size,
            archivedConcepts: this.config.enableArchive ? this.archive.size : 0,
            memoryPressure: this.pressureLevel,
            utilization: this.concepts.size / this.config.maxConcepts,
            conceptDistribution: {
                lowPriority: stats.lowPriority,
                mediumPriority: stats.mediumPriority,
                highPriority: stats.highPriority,
            },
        };

        if (this.config.enableIndexing) result.indexStats = this.index.stats;
        if (this.config.enableArchive) result.archiveStats = this.archive.stats;
        return result;
    }

    setConfig(updates: Partial<MemoryConfig>): void {
        Object.assign(this.config, updates);
    }

    retrieveFromArchive(term: Term): Concept | undefined {
        if (!this.config.enableArchive) return undefined;
        const concept = this.archive.retrieve(term);
        if (concept) {
            this.archive.unarchive(term);
            this.addConcept(term);
        }
        return concept;
    }

    queryBySymbol(symbol: string): Concept[] {
        if (!this.config.enableIndexing) return [];
        return this.index.getByAtomic(symbol);
    }

    queryByTimeRange(start: number, end: number): Concept[] {
        if (!this.config.enableIndexing) return [];
        return this.index.getByTemporal([start, end]);
    }

    checkHealth(): MemoryHealth {
        const now = Date.now();
        if (now - this.lastHealthCheck >= this.healthCheckInterval) this.lastHealthCheck = now;
        return this.computeHealth();
    }

    compact(): void {
        const toRemove = this.listConcepts()
            .filter((c) => c.priority < 0.1 && c.totalTasks === 0)
            .sort((a, b) => a.priority - b.priority);

        toRemove.push(...this.findOrphanedLinks());
        const removeCount = Math.ceil(this.concepts.size * 0.1);
        for (const concept of toRemove.slice(0, removeCount)) {
            this.removeConcept(concept.term);
        }
        this.updateAllFocus();
    }

    mergeConcepts(concepts: Concept[]): ConceptMergeResult | null {
        if (concepts.length < 2) return null;
        const primary = concepts[0];
        if (!primary) return null;
        const others = concepts.slice(1);
        for (const other of others) {
            if (!primary.canMergeWith(other, 0.85)) return null;
        }
        return primary.mergeWith(others);
    }

    findSimilarConcepts(term: Term, limit = 10): Concept[] {
        const allConcepts = Array.from(this.concepts.values());
        const scored = allConcepts.map((concept) => ({concept, similarity: calculateSimilarity(concept.term, term)}));
        scored.sort((a, b) => b.similarity - a.similarity);
        return scored.slice(0, limit).map((s) => s.concept);
    }

    private applyForgetting(): void {
        const concept = this.forgetting.selectVictim(Array.from(this.concepts.values()), this.scorer);
        if (concept) this.removeConcept(concept.term);
    }

    private updateFocus(concept: Concept): void {
        this.focus.addToFocus(concept);
    }

    private updateAllFocus(): void {
        this.focus.clearFocus();
        const sorted = [...this.concepts.values()].sort((a, b) => b.priority - a.priority);
        for (const concept of sorted.slice(0, this.config.focusMaxConcepts)) {
            this.focus.addToFocus(concept);
        }
    }

    private computeHealth(): MemoryHealth {
        const utilization = this.concepts.size / this.config.maxConcepts;
        const consolidationNeeded = this.cyclesSinceConsolidation >= this.config.consolidationInterval;
        return {
            isHealthy: utilization < 0.9 && !consolidationNeeded,
            pressureLevel: utilization,
            consolidationNeeded,
            forgettingNeeded: utilization > 0.8,
            recommendations: [],
        };
    }

    private findOrphanedLinks(): Concept[] {
        const knownKeys = new Set(this.concepts.keys());
        return [...this.concepts.values()].filter((concept) =>
            concept.getLinks().some((link) => !knownKeys.has(link.concept.key)),
        );
    }
}

export {serialize, deserialize, validate, repair, type SerializedMemory} from './state/serialization.js';
