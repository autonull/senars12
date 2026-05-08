import {Memory} from './memory.js';
import type {Concept} from './concept.js';

export interface ConsolidationConfig {
  healthCheckInterval: number;
  decayRate: number;
  consolidationThreshold: number;
  archiveThreshold: number;
  enableActivationPropagation: boolean;
  enableDecay: boolean;
  enableForgetting: boolean;
}

const DEFAULT_CONFIG: ConsolidationConfig = {
  healthCheckInterval: 100,
  decayRate: 0.01,
  consolidationThreshold: 0.5,
  archiveThreshold: 0.2,
  enableActivationPropagation: true,
  enableDecay: true,
  enableForgetting: true
};

export class MemoryConsolidation {
  private config: ConsolidationConfig;
  private lastHealthCheck: number;
  private consolidationCount: number;
  private totalConceptsProcessed: number = 0;
  private totalConceptsForgotten: number = 0;
  private totalConceptsArchived: number = 0;

  constructor(config: ConsolidationConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.lastHealthCheck = 0;
    this.consolidationCount = 0;
  }

  get stats(): {
    consolidationCount: number;
    lastHealthCheck: number;
    totalConceptsProcessed: number;
    totalConceptsForgotten: number;
    totalConceptsArchived: number;
  } {
    return {
      consolidationCount: this.consolidationCount,
      lastHealthCheck: this.lastHealthCheck,
      totalConceptsProcessed: this.totalConceptsProcessed,
      totalConceptsForgotten: this.totalConceptsForgotten,
      totalConceptsArchived: this.totalConceptsArchived
    };
  }

  checkHealth(memory: Memory): void {
    const now = Date.now();
    if (now - this.lastHealthCheck >= this.config.healthCheckInterval * 1000) {
      this.consolidate(memory);
      this.lastHealthCheck = now;
    }
  }

  consolidate(memory: Memory): void {
    const concepts = memory.listConcepts();
    this.totalConceptsProcessed += concepts.length;

    if (this.config.enableActivationPropagation) {
      this.propagateActivation(concepts);
    }

    if (this.config.enableDecay) {
      this.applyDecay(concepts);
    }

    if (this.config.enableForgetting) {
      const { archived, forgotten } = this.evaluateForgetting(memory, concepts);
      this.totalConceptsForgotten += forgotten;
      this.totalConceptsArchived += archived;
    }

    this.consolidationCount++;
  }

  private propagateActivation(concepts: Concept[]): void {
    const iterations = 2;
    for (let i = 0; i < iterations; i++) {
      for (const concept of concepts) {
        const activation = concept.priority;
        if (activation > 0.1) {
          const neighbors = this.getRelatedConcepts(concept, concepts);
          for (const neighbor of neighbors) {
            const boost = activation * 0.1;
            (neighbor as any).priority = Math.min(1.0, (neighbor.priority || 0) + boost);
          }
        }
      }
    }
  }

  private getRelatedConcepts(concept: Concept, allConcepts: Concept[]): Concept[] {
    const term = concept.term;
    const related: Concept[] = [];
    const subject = (term as any).args?.[0];
    const predicate = (term as any).args?.[1];

    for (const c of allConcepts) {
      if (c === concept) continue;
      const cTerm = c.term;
      const cSubject = (cTerm as any).args?.[0];
      const cPredicate = (cTerm as any).args?.[1];

      if (subject && cSubject && subject.hash === cSubject.hash) {
        related.push(c);
      } else if (predicate && cPredicate && predicate.hash === cPredicate.hash) {
        related.push(c);
      } else if (cTerm.hash === term.hash) {
        related.push(c);
      }
    }

    return related.slice(0, 10);
  }

  private applyDecay(concepts: Concept[]): void {
    for (const concept of concepts) {
      const decay = this.config.decayRate * (1 - concept.priority);
      concept.priority = Math.max(0, concept.priority - decay);
    }
  }

  private evaluateForgetting(memory: Memory, concepts: Concept[]): { archived: number; forgotten: number } {
    const toArchive: Concept[] = [];
    const toForget: Concept[] = [];

    for (const concept of concepts) {
      if (concept.priority < this.config.archiveThreshold && concept.totalTasks === 0) {
        toArchive.push(concept);
      } else if (concept.priority < 0.05 && concept.totalTasks === 0) {
        toForget.push(concept);
      }
    }

    let archived = 0;
    for (const concept of toArchive) {
      if ((memory as any).archiveConcept?.(concept)) {
        archived++;
      }
    }

    let forgotten = 0;
    for (const concept of toForget) {
      if (memory.removeConcept(concept.term)) {
        forgotten++;
      }
    }

    return { archived, forgotten };
  }

  reset(): void {
    this.consolidationCount = 0;
    this.lastHealthCheck = 0;
    this.totalConceptsProcessed = 0;
    this.totalConceptsForgotten = 0;
    this.totalConceptsArchived = 0;
  }
}

export const memoryConsolidation = new MemoryConsolidation();
