import { termsEqual } from '../../terms';
import type { Concept } from '../concept.js';
import type { Memory } from '../memory.js';

export interface ConsolidationConfig {
  healthCheckInterval: number;
  decayRate: number;
  enableActivationPropagation: boolean;
  enableDecay: boolean;
  enableForgetting: boolean;
}

const DEFAULT_CONFIG: ConsolidationConfig = {
  healthCheckInterval: 100,
  decayRate: 0.01,
  enableActivationPropagation: true,
  enableDecay: true,
  enableForgetting: true,
};

export class MemoryConsolidation {
  private config: ConsolidationConfig;
  private lastHealthCheck: number;
  private consolidationCount: number;
  private totalConceptsProcessed = 0;
  private totalConceptsForgotten = 0;
  private totalConceptsArchived = 0;

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
      totalConceptsArchived: this.totalConceptsArchived,
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

  reset(): void {
    this.consolidationCount = 0;
    this.lastHealthCheck = 0;
    this.totalConceptsProcessed = 0;
    this.totalConceptsForgotten = 0;
    this.totalConceptsArchived = 0;
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
            neighbor.priority = Math.min(1.0, neighbor.priority + boost);
          }
        }
      }
    }
  }

  private getRelatedConcepts(concept: Concept, allConcepts: Concept[]): Concept[] {
    const term = concept.term;
    const related: Concept[] = [];

    for (const c of allConcepts) {
      if (c === concept) continue;
      const cTerm = c.term;

      const termArgs = 'args' in term ? term.args : undefined;
      const cTermArgs = 'args' in cTerm ? cTerm.args : undefined;

      const subject = termArgs?.[0];
      const predicate = termArgs?.[1];
      const cSubject = cTermArgs?.[0];
      const cPredicate = cTermArgs?.[1];

      if (subject && cSubject && termsEqual(subject, cSubject)) {
        related.push(c);
      } else if (predicate && cPredicate && termsEqual(predicate, cPredicate)) {
        related.push(c);
      } else if (termsEqual(cTerm, term)) {
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

  private evaluateForgetting(
    memory: Memory,
    concepts: Concept[]
  ): { archived: number; forgotten: number } {
    const toArchive: Concept[] = [];
    const toForget: Concept[] = [];

    const capacityPressure = concepts.length / memory['config'].maxConcepts;

    const candidates = concepts.filter((c) => c.totalTasks === 0);
    if (candidates.length === 0) return { archived: 0, forgotten: 0 };

    candidates.sort((a, b) => a.priority - b.priority);

    if (capacityPressure > 0.8) {
      const archiveCount = Math.ceil(candidates.length * Math.min(0.3, capacityPressure - 0.5));
      toArchive.push(...candidates.slice(0, archiveCount));
    }

    if (capacityPressure > 0.9) {
      const forgetCount = Math.ceil(candidates.length * Math.min(0.2, capacityPressure - 0.8));
      const remaining = candidates.filter((c) => !toArchive.includes(c));
      toForget.push(...remaining.slice(0, forgetCount));
    }

    let archived = 0;
    for (const concept of toArchive) {
      if (memory.archiveConcept(concept)) {
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
}
