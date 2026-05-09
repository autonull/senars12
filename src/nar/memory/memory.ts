import {Concept, type ConceptMergeResult, type ConceptTaskType} from './concept.js';
import type {Term, Truth} from '../terms';
import type {Budget} from '../types';
import {getBudgetValue} from '../types';
import {MemoryIndex} from './memory-index.js';
import {Focus} from './focus.js';
import {Archive} from './archive.js';
import {MemoryScorer} from './scorer.js';
import {MemoryConsolidation} from './consolidation.js';
import type {ForgettingPolicy} from './forgetting.js';
import {Forgetting} from './forgetting.js';
import {jaccard} from '../utils/similarity.js';
import {extractSymbols} from '../terms/utils.js';
import {THRESHOLDS} from '../constants.js';

export interface MemoryConfig {
    maxConcepts?: number;
    priorityThreshold?: number;
    activationDecayRate?: number;
    consolidationInterval?: number;
    focusMaxConcepts?: number;
    focusThreshold?: number;
    archiveThreshold?: number;
    archiveMaxConcepts?: number;
    enableIndexing?: boolean;
    enableArchive?: boolean;
    forgettingPolicy?: ForgettingPolicy;
    healthCheckInterval?: number;
    enablePressureDetection?: boolean;
    pressureThreshold?: number;
}

const DEFAULT_CONFIG: Required<MemoryConfig> = {
    maxConcepts: 1000, priorityThreshold: 0.5, activationDecayRate: 0.01, consolidationInterval: 10,
    focusMaxConcepts: 50, focusThreshold: 0.3, archiveThreshold: 0.2, archiveMaxConcepts: 1000,
    enableIndexing: true, enableArchive: true, forgettingPolicy: 'fifo', healthCheckInterval: 1000,
    enablePressureDetection: true, pressureThreshold: 0.9,
};

export interface MemoryStatistics {
    totalConcepts: number; totalTasks: number; focusedConcepts: number; archivedConcepts: number;
    indexStats?: { atomic: number; temporal: number; activation: number };
    archiveStats?: { size: number; capacity: number; utilization: number };
    memoryPressure: number; utilization: number;
    conceptDistribution: { lowPriority: number; mediumPriority: number; highPriority: number; };
}

export interface MemoryHealth {
    isHealthy: boolean; pressureLevel: number; consolidationNeeded: boolean;
    forgettingNeeded: boolean; recommendations: string[];
}

const distribution = (concepts: Iterable<Concept>) => {
    let total = 0, low = 0, med = 0, high = 0;
    for (const c of concepts) {
        total += c.totalTasks;
        if (c.priority < 0.3) low++; else if (c.priority < 0.7) med++; else high++;
    }
    return {totalTasks: total, lowPriority: low, mediumPriority: med, highPriority: high};
};

export class Memory {
    private readonly concepts = new Map<number, Concept>();
    private readonly config: Required<MemoryConfig>;
    private readonly index: MemoryIndex;
    private readonly focus: Focus;
    private readonly archive: Archive;
    private readonly scorer: MemoryScorer;
    private readonly consolidation = new MemoryConsolidation();
    private readonly forgetting = new Forgetting(DEFAULT_CONFIG.forgettingPolicy);
    private cyclesSinceConsolidation = 0;
    private lastTimestamp = Date.now();
    private healthCheckInterval = DEFAULT_CONFIG.healthCheckInterval;
    private lastHealthCheck = 0;
    private pressureLevel = 0;
    private readonly onMemoryPressure?: (level: number, memory: Memory) => void;

    constructor(config: MemoryConfig = DEFAULT_CONFIG, options?: { onMemoryPressure?: (level: number, memory: Memory) => void }) {
        this.config = {...DEFAULT_CONFIG, ...config};
        this.healthCheckInterval = this.config.healthCheckInterval;
        this.onMemoryPressure = options?.onMemoryPressure;
        this.index = new MemoryIndex({enableAtomicIndex: this.config.enableIndexing, enableTemporalIndex: this.config.enableIndexing, enableActivationIndex: true});
        this.focus = new Focus({maxConcepts: this.config.focusMaxConcepts, attentionThreshold: this.config.focusThreshold});
        this.archive = new Archive({maxArchivedConcepts: this.config.archiveMaxConcepts, archiveThreshold: this.config.archiveThreshold});
        this.scorer = new MemoryScorer();
    }

    get size(): number { return this.concepts.size; }
    getConcept(term: Term): Concept | undefined { return this.concepts.get(term.hash); }

    addConcept(term: Term): Concept {
        const existing = this.concepts.get(term.hash);
        if (existing) return existing;
        if (this.concepts.size >= this.config.maxConcepts) this.applyForgetting();
        this.checkMemoryPressure();
        const concept = new Concept(term);
        this.concepts.set(term.hash, concept);
        if (this.config.enableIndexing) this.index.index(concept, this.lastTimestamp);
        this.focus.addToFocus(concept);
        return concept;
    }

    addTask(term: Term, type: ConceptTaskType, truth?: Truth, budget: Budget | number = 0.9): boolean {
        return (this.getConcept(term) ?? this.addConcept(term)).addTask(type, {term, truth, budget: getBudgetValue(budget)});
    }

    removeConcept(term: Term): boolean {
        const concept = this.concepts.get(term.hash);
        if (!concept) return false;
        this.focus.removeFromFocus(concept);
        if (this.config.enableIndexing) this.index.remove(concept);
        this.concepts.delete(term.hash);
        return true;
    }

    getFocusConcepts(): Concept[] { return this.focus.getFocusSet(); }

    sample(limit: number): Concept[] {
        return [...this.concepts.values()]
            .map(c => ({concept: c, score: this.scorer.scoreForRetrieval(c)}))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(s => s.concept);
    }

    consolidate(): void {
        if (++this.cyclesSinceConsolidation < this.config.consolidationInterval) return;
        this.cyclesSinceConsolidation = 0;
        for (const c of this.concepts.values()) c.decay(this.config.activationDecayRate);

        const toArchive: Concept[] = [], toRemove: Concept[] = [];
        for (const c of this.concepts.values()) {
            if (c.priority < this.config.priorityThreshold && c.totalTasks === 0) {
                (this.config.enableArchive && c.priority < this.config.archiveThreshold) ? toArchive.push(c) : toRemove.push(c);
            }
        }
        if (this.config.enableArchive) toArchive.forEach(c => this.archiveConcept(c));
        toRemove.forEach(c => this.removeConcept(c.term));
        this.updateAllFocus();
    }

    archiveConcept(concept: Concept): boolean {
        if (this.config.enableArchive) { this.archive.archive(concept); this.index.remove(concept); return true; }
        return false;
    }

    listConcepts(): Concept[] { return [...this.concepts.values()]; }

    clear(): void {
        this.concepts.clear(); this.focus.clearFocus();
        if (this.config.enableIndexing) this.index.clear();
        if (this.config.enableArchive) this.archive.clear();
    }

    getStatistics(): MemoryStatistics {
        const dist = distribution(this.concepts.values());
        const stats: MemoryStatistics = {
            totalConcepts: this.concepts.size, totalTasks: dist.totalTasks, focusedConcepts: this.focus.size,
            archivedConcepts: this.config.enableArchive ? this.archive.size : 0,
            memoryPressure: this.pressureLevel, utilization: this.concepts.size / this.config.maxConcepts,
            conceptDistribution: {lowPriority: dist.lowPriority, mediumPriority: dist.mediumPriority, highPriority: dist.highPriority}
        };
        if (this.config.enableIndexing) stats.indexStats = this.index.stats;
        if (this.config.enableArchive) stats.archiveStats = this.archive.stats;
        return stats;
    }

    setConfig(updates: Partial<MemoryConfig>): void { Object.assign(this.config, updates); }

    retrieveFromArchive(term: Term): Concept | undefined {
        if (!this.config.enableArchive) return undefined;
        const concept = this.archive.retrieve(term.hash);
        if (concept) { this.archive.unarchive(term.hash); this.addConcept(term); }
        return concept;
    }

    queryBySymbol(symbol: string): Concept[] { return this.config.enableIndexing ? this.index.getByAtomic(symbol) : []; }
    queryByTimeRange(start: number, end: number): Concept[] { return this.config.enableIndexing ? this.index.getByTemporal([start, end]) : []; }

    checkHealth(): MemoryHealth {
        const now = Date.now();
        if (now - this.lastHealthCheck < this.healthCheckInterval) return this.getLastHealth();
        this.lastHealthCheck = now;

        const recommendations: string[] = [];
        const utilization = this.concepts.size / this.config.maxConcepts;
        const consolidationNeeded = this.cyclesSinceConsolidation >= this.config.consolidationInterval;
        const forgettingNeeded = utilization > 0.8;

        if (utilization > 0.9) recommendations.push('Memory utilization above 90%');
        if (consolidationNeeded) recommendations.push('Consolidation overdue');
        if (forgettingNeeded) recommendations.push('High memory pressure');

        return {isHealthy: utilization < 0.9 && !consolidationNeeded, pressureLevel: utilization, consolidationNeeded, forgettingNeeded, recommendations};
    }

    compact(): void {
        const toRemove = [...this.concepts.values()].filter(c => c.priority < 0.1 && c.totalTasks === 0)
            .sort((a, b) => a.priority - b.priority);
        toRemove.push(...this.findOrphanedLinks());
        toRemove.slice(0, Math.ceil(this.concepts.size * 0.1)).forEach(c => this.removeConcept(c.term));
        this.updateAllFocus();
    }

    getMemoryPressure(): number { return this.pressureLevel; }

    mergeConcepts(concepts: Concept[]): ConceptMergeResult | null {
        if (concepts.length < 2) return null;
        const primary = concepts[0];
        if (!primary || concepts.slice(1).some(o => !primary.canMergeWith(o, 0.85))) return null;
        return primary.mergeWith(concepts.slice(1));
    }

    findSimilarConcepts(term: Term, limit = 10): Concept[] {
        return [...this.concepts.values()]
            .map(c => ({concept: c, similarity: c.term.hash === term.hash ? 1 : jaccard(extractSymbols(c.term), extractSymbols(term))}))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit)
            .map(s => s.concept);
    }

    private applyForgetting(): void {
        const victim = this.forgetting.selectVictim([...this.concepts.values()], this.scorer);
        if (victim) this.removeConcept(victim.term);
    }

    private updateAllFocus(): void {
        this.focus.clearFocus();
        for (const c of this.concepts.values()) {
            if (c.priority >= this.config.priorityThreshold) this.focus.addToFocus(c);
        }
    }

    private getLastHealth(): MemoryHealth {
        const utilization = this.concepts.size / this.config.maxConcepts;
        return {isHealthy: utilization < 0.9, pressureLevel: utilization, consolidationNeeded: this.cyclesSinceConsolidation >= this.config.consolidationInterval, forgettingNeeded: utilization > 0.8, recommendations: []};
    }

    private checkMemoryPressure(): void {
        if (!this.config.enablePressureDetection) return;
        this.pressureLevel = this.concepts.size / this.config.maxConcepts;
        if (this.pressureLevel >= this.config.pressureThreshold) {
            this.onMemoryPressure?.(this.pressureLevel, this);
            for (const c of this.concepts.values()) c.applyTimeDecay(this.config.activationDecayRate);
            this.compact();
        }
    }

    private findOrphanedLinks(): Concept[] {
        const orphaned: Concept[] = [];
        for (const c of this.concepts.values()) {
            if (c.getLinks().some(l => !this.concepts.has(l.concept.key))) orphaned.push(c);
        }
        return orphaned;
    }
}

export {serialize, deserialize, validate, repair} from './serialization.js';
export type {SerializedMemory} from './serialization.js';