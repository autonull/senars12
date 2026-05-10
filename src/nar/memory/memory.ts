/**
 * Enhanced Memory system with integrated indexing, focus, archive, scoring, and consolidation
 */

import {Concept, type ConceptMergeResult, type ConceptTaskType} from './concept.js';
import type {Term, Truth} from '../terms';
import type {Budget} from '../types';
import {MemoryIndex} from './memory-index.js';
import {Focus} from './focus.js';
import {Archive} from './archive.js';
import {MemoryScorer} from './scorer.js';
import {MemoryConsolidation} from './consolidation.js';
import type {ForgettingPolicy} from './forgetting.js';
import {Forgetting} from './forgetting.js';
import {calculateSimilarity} from '../terms/utils.js';

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
    maxConcepts: 1000,
    priorityThreshold: 0.5,
    activationDecayRate: 0.01,
    consolidationInterval: 10,
    focusMaxConcepts: 50,
    focusThreshold: 0.3,
    archiveThreshold: 0.2,
    archiveMaxConcepts: 1000,
    enableIndexing: true,
    enableArchive: true,
    forgettingPolicy: 'fifo',
    healthCheckInterval: 1000,
    enablePressureDetection: true,
    pressureThreshold: 0.9,
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
    conceptDistribution: {
        lowPriority: number;
        mediumPriority: number;
        highPriority: number;
    };
}

export interface MemoryHealth {
    isHealthy: boolean;
    pressureLevel: number;
    consolidationNeeded: boolean;
    forgettingNeeded: boolean;
    recommendations: string[];
}

export class Memory {
    private readonly concepts = new Map<number, Concept>();
    private readonly config: Required<MemoryConfig>;
    private readonly index: MemoryIndex;
    private readonly focus: Focus;
    private readonly archive: Archive;
    private readonly scorer: MemoryScorer;
    private readonly consolidation: MemoryConsolidation;
    private readonly forgetting: Forgetting;
    private cyclesSinceConsolidation = 0;
    private lastTimestamp = Date.now();
    private readonly healthCheckInterval: number;
    private lastHealthCheck = 0;
    private pressureLevel = 0;
    private readonly onMemoryPressure?: (level: number, memory: Memory) => void;

    constructor(
        config: MemoryConfig = DEFAULT_CONFIG,
        options?: { onMemoryPressure?: (level: number, memory: Memory) => void }
    ) {
        this.config = {...DEFAULT_CONFIG, ...config};
        this.healthCheckInterval = this.config.healthCheckInterval;
        this.onMemoryPressure = options?.onMemoryPressure;
        this.index = new MemoryIndex({
            enableAtomicIndex: this.config.enableIndexing,
            enableTemporalIndex: this.config.enableIndexing,
            enableActivationIndex: true,
        });
        this.focus = new Focus({
            maxConcepts: this.config.focusMaxConcepts,
            attentionThreshold: this.config.focusThreshold,
        });
        this.archive = new Archive({
            maxArchivedConcepts: this.config.archiveMaxConcepts,
            archiveThreshold: this.config.archiveThreshold,
        });
        this.scorer = new MemoryScorer();
        this.consolidation = new MemoryConsolidation();
        this.forgetting = new Forgetting(this.config.forgettingPolicy);
    }

    get size(): number {
        return this.concepts.size;
    }

    getConcept(term: Term): Concept | undefined {
        return this.concepts.get(term.hash);
    }

    addConcept(term: Term): Concept {
        const existing = this.concepts.get(term.hash);
        if (existing) return existing;

        if (this.concepts.size >= this.config.maxConcepts) {
            this.applyForgetting();
        }

        this.checkMemoryPressure();

        const concept = new Concept(term);
        this.concepts.set(term.hash, concept);

        if (this.config.enableIndexing) {
            this.index.index(concept, this.lastTimestamp);
        }

        this.updateFocus(concept);

        return concept;
    }

addTask(term: Term, type: ConceptTaskType, truth?: Truth, budget: Budget = {priority: 0.9, durability: 0.8, quality: 0.9, cycles: 0, depth: 0}): boolean {
  const concept = this.getConcept(term) ?? this.addConcept(term);
  return concept.addTask(type, {term, truth, budget});
}

    removeConcept(term: Term): boolean {
        const concept = this.concepts.get(term.hash);
        if (concept) {
            this.focus.removeFromFocus(concept);
            if (this.config.enableIndexing) {
                this.index.remove(concept);
            }
            this.concepts.delete(term.hash);
            return true;
        }
        return false;
    }

    getFocusConcepts(): Concept[] {
        return this.focus.getFocusSet();
    }

    sample(limit: number): Concept[] {
        const allConcepts = Array.from(this.concepts.values());
        const scored = allConcepts.map(concept => ({
            concept,
            score: this.scorer.scoreForRetrieval(concept),
        }));
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, limit).map(s => s.concept);
    }

    consolidate(): void {
        if (++this.cyclesSinceConsolidation < this.config.consolidationInterval) return;
        this.cyclesSinceConsolidation = 0;

        const {activationDecayRate, priorityThreshold} = this.config;

        for (const concept of this.concepts.values()) {
            concept.decay(activationDecayRate);
        }

        const toArchive: Concept[] = [];
        const toRemove: Concept[] = [];

        for (const [, concept] of this.concepts) {
            const _score = this.scorer.scoreForConsolidation(concept);
            if (concept.priority < priorityThreshold && concept.totalTasks === 0) {
                if (this.config.enableArchive && concept.priority < this.config.archiveThreshold) {
                    toArchive.push(concept);
                } else {
                    toRemove.push(concept);
                }
            }
        }

        if (this.config.enableArchive) {
            for (const concept of toArchive) {
                this.archiveConcept(concept);
            }
        }

        for (const concept of toRemove) {
            this.removeConcept(concept.term);
        }

        this.updateAllFocus();
    }

    archiveConcept(concept: Concept): boolean {
        if (this.config.enableArchive) {
            this.archive.archive(concept);
            this.index.remove(concept);
            return true;
        }
        return false;
    }

    listConcepts(): Concept[] {
        return Array.from(this.concepts.values());
    }

    clear(): void {
        this.concepts.clear();
        this.focus.clearFocus();
        if (this.config.enableIndexing) {
            this.index.clear();
        }
        if (this.config.enableArchive) {
            this.archive.clear();
        }
    }

    getStatistics(): MemoryStatistics {
        let totalTasks = 0;
        let lowPriority = 0;
        let mediumPriority = 0;
        let highPriority = 0;

        for (const concept of this.concepts.values()) {
            totalTasks += concept.totalTasks;
            if (concept.priority < 0.3) {
                lowPriority++;
            } else if (concept.priority < 0.7) {
                mediumPriority++;
            } else {
                highPriority++;
            }
        }

        const stats: MemoryStatistics = {
            totalConcepts: this.concepts.size,
            totalTasks,
            focusedConcepts: this.focus.size,
            archivedConcepts: this.config.enableArchive ? this.archive.size : 0,
            memoryPressure: this.pressureLevel,
            utilization: this.concepts.size / this.config.maxConcepts,
            conceptDistribution: {
                lowPriority,
                mediumPriority,
                highPriority,
            },
        };

        if (this.config.enableIndexing) {
            stats.indexStats = this.index.stats;
        }

        if (this.config.enableArchive) {
            stats.archiveStats = this.archive.stats;
        }

        return stats;
    }

    setConfig(updates: Partial<MemoryConfig>): void {
        Object.assign(this.config, updates);
    }

    retrieveFromArchive(term: Term): Concept | undefined {
        if (!this.config.enableArchive) return undefined;
        const concept = this.archive.retrieve(term.hash);
        if (concept) {
            this.archive.unarchive(term.hash);
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
        if (now - this.lastHealthCheck < this.healthCheckInterval) {
            return this.getLastHealth();
        }
        this.lastHealthCheck = now;

        const recommendations: string[] = [];
        const utilization = this.concepts.size / this.config.maxConcepts;
        const consolidationNeeded = this.cyclesSinceConsolidation >= this.config.consolidationInterval;
        const forgettingNeeded = utilization > 0.8;

        if (utilization > 0.9) {
            recommendations.push('Memory utilization above 90% - consider increasing capacity or reducing concept count');
        }

        if (consolidationNeeded) {
            recommendations.push('Consolidation overdue - run consolidate() to apply decay and cleanup');
        }

        if (forgettingNeeded) {
            recommendations.push('High memory pressure - forgetting will be triggered on next concept addition');
        }

        const health: MemoryHealth = {
            isHealthy: utilization < 0.9 && !consolidationNeeded,
            pressureLevel: utilization,
            consolidationNeeded,
            forgettingNeeded,
            recommendations,
        };

        return health;
    }

    compact(): void {
        const toRemove: Concept[] = [];

        for (const concept of this.concepts.values()) {
            if (concept.priority < 0.1 && concept.totalTasks === 0) {
                toRemove.push(concept);
            }
        }

        toRemove.sort((a, b) => a.priority - b.priority);
        const orphanedLinks = this.findOrphanedLinks();
        toRemove.push(...orphanedLinks);

        for (const concept of toRemove.slice(0, Math.ceil(this.concepts.size * 0.1))) {
            this.removeConcept(concept.term);
        }

        this.updateAllFocus();
    }

    getMemoryPressure(): number {
        return this.pressureLevel;
    }

    mergeConcepts(concepts: Concept[]): ConceptMergeResult | null {
        if (concepts.length < 2) return null;

        const primary = concepts[0];
        if (!primary) return null;
        const others = concepts.slice(1);

        for (const other of others) {
            if (!primary.canMergeWith(other, 0.85)) {
                return null;
            }
        }

        return primary.mergeWith(others);
    }

  findSimilarConcepts(term: Term, limit = 10): Concept[] {
    const allConcepts = Array.from(this.concepts.values());
    const scored = allConcepts.map(concept => ({
      concept,
      similarity: calculateSimilarity(concept, term),
    }));

        scored.sort((a, b) => b.similarity - a.similarity);
        return scored.slice(0, limit).map(s => s.concept);
    }

    private applyForgetting(): void {
        const concept = this.forgetting.selectVictim(
            Array.from(this.concepts.values()),
            this.scorer
        );
        if (concept) {
            this.removeConcept(concept.term);
        }
    }

    private updateFocus(concept: Concept): void {
        this.focus.addToFocus(concept);
    }

    private updateAllFocus(): void {
        this.focus.clearFocus();
        for (const concept of this.concepts.values()) {
            if (concept.priority >= this.config.priorityThreshold) {
                this.focus.addToFocus(concept);
            }
        }
    }

    private getLastHealth(): MemoryHealth {
        const utilization = this.concepts.size / this.config.maxConcepts;
        const consolidationNeeded = this.cyclesSinceConsolidation >= this.config.consolidationInterval;
        const forgettingNeeded = utilization > 0.8;

        return {
            isHealthy: utilization < 0.9 && !consolidationNeeded,
            pressureLevel: utilization,
            consolidationNeeded,
            forgettingNeeded,
            recommendations: [],
        };
    }

    private checkMemoryPressure(): void {
        if (!this.config.enablePressureDetection) return;

        const utilization = this.concepts.size / this.config.maxConcepts;
        this.pressureLevel = utilization;

        if (utilization >= this.config.pressureThreshold) {
            this.onMemoryPressure?.(utilization, this);

            for (const concept of this.concepts.values()) {
                concept.applyTimeDecay(this.config.activationDecayRate);
            }

            this.compact();
        }
    }

    private findOrphanedLinks(): Concept[] {
        const orphaned: Concept[] = [];

        for (const concept of this.concepts.values()) {
            const links = concept.getLinks();
            for (const link of links) {
                if (!this.concepts.has(link.concept.key)) {
                    orphaned.push(concept);
                    break;
                }
            }
        }

  return orphaned;
  }
}

// Serialization
export {
    serialize,
    deserialize,
    validate,
    repair,
    type SerializedMemory,
} from './serialization.js';
