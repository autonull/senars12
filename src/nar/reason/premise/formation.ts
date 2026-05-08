import type {Task, ConceptLike} from '../../types';
import type {Memory} from '../../memory';
import {Truth} from '../../terms';

export interface PremiseSelector {
  readonly name: string;
  select(task: Task, memory: Memory, limit?: number): Task[];
}

export interface PremiseConfig {
  sampleSize: number;
  qualityThreshold: number;
  diversityWindow: number;
  filters: Array<(task: Task, memory: Memory) => boolean>;
}

export class PremiseFormation {
  private readonly recentPairs: Set<string> = new Set();
  private readonly maxRecentPairs = 500;

  constructor(private readonly config: Partial<PremiseConfig> = {}) {}

  formPremises(task: Task, memory: Memory, selector: PremiseSelector): Task[] {
    const premises = selector.select(task, memory, 20);

    const filtered = premises.filter(p => {
      if (!this.checkQuality(p)) return false;
      if (!this.checkDiversity(task, p)) return false;
      return this.applyFilters(p, memory);
    });

    return filtered;
  }

  private checkQuality(premise: Task): boolean {
    const threshold = this.config.qualityThreshold ?? 0;
    const quality = premise.truth?.f ?? 0.5;
    return quality >= threshold;
  }

  private checkDiversity(primary: Task, secondary: Task): boolean {
    const pairKey = `${primary.term.hash}-${secondary.term.hash}`;
    const reverseKey = `${secondary.term.hash}-${primary.term.hash}`;

    if (this.recentPairs.has(pairKey) || this.recentPairs.has(reverseKey)) {
      return false;
    }

    if (this.recentPairs.size >= this.maxRecentPairs) {
      const first = this.recentPairs.values().next().value;
      if (first) this.recentPairs.delete(first);
    }

    this.recentPairs.add(pairKey);
    return true;
  }

  private applyFilters(premise: Task, memory: Memory): boolean {
    const filters = this.config.filters ?? [];
    return filters.every(filter => filter(premise, memory));
  }

  clearDiversityCache(): void {
    this.recentPairs.clear();
  }
}

export class TermMatchingSelector implements PremiseSelector {
  readonly name = 'term-matching';

  constructor(private readonly sampleSize = 20) {}

  select(task: Task, memory: Memory, limit = 10): Task[] {
    const results: Task[] = [];
    const concepts = memory.sample(this.sampleSize);

    for (const concept of concepts) {
      if (concept.term.hash === task.term.hash) continue;

      const belief = concept.beliefBag.peek();
      if (!belief?.truth) continue;

      results.push(this.createTask(concept, belief.truth));
      if (results.length >= limit) break;
    }

    return results;
  }

  private createTask(concept: ConceptLike, truth: {f: number; c: number}): Task {
    return {
      term: concept.term,
      type: 'belief' as const,
      truth,
      budget: {priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0},
      stamp: Object.freeze({
        id: '',
        creationTime: 0,
        source: 'INPUT' as const,
        derivations: [],
        depth: 0
      }),
      occurrenceTime: 0,
      derived: false
    };
  }
}

export class DecompositionSelector implements PremiseSelector {
  readonly name = 'decomposition';

  select(task: Task, memory: Memory, limit = 10): Task[] {
    const results: Task[] = [];

    if (task.term.kind !== 'conjunction') {
      return results;
    }

    for (const arg of task.term.args ?? []) {
      const concept = memory.getConcept(arg);
      if (!concept) continue;

      const belief = concept.beliefBag.peek();
      if (!belief?.truth) continue;

      results.push({
        term: arg,
        type: 'belief' as const,
        truth: belief.truth,
        budget: {priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0},
        stamp: Object.freeze({
          id: '',
          creationTime: 0,
          source: 'INPUT' as const,
          derivations: [],
          depth: 0
        }),
        occurrenceTime: 0,
        derived: false
      });

      if (results.length >= limit) break;
    }

    return results;
  }
}

export class AnalogySelector implements PremiseSelector {
  readonly name = 'analogy';

  constructor(private readonly sampleSize = 15) {}

  select(task: Task, memory: Memory, limit = 5): Task[] {
    const results: Task[] = [];
    const concepts = memory.sample(this.sampleSize);

    for (const concept of concepts) {
      if (concept.term.hash === task.term.hash) continue;
      if (concept.term.kind !== 'inheritance') continue;

      const belief = concept.beliefBag.peek();
      if (!belief?.truth) continue;

      if (task.term.kind === 'inheritance') {
        const taskSub = task.term.subterms?.[0];
        const taskPred = task.term.subterms?.[1];
        const conceptSub = concept.term.subterms?.[0];
        const conceptPred = concept.term.subterms?.[1];

        const hasOverlap = taskSub?.hash === conceptSub ||
          taskSub?.hash === conceptPred ||
          taskPred?.hash === conceptSub ||
          taskPred?.hash === conceptPred;

        if (!hasOverlap) continue;
      }

      results.push({
        term: concept.term,
        type: 'belief' as const,
        truth: belief.truth,
        budget: {priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0},
        stamp: Object.freeze({
          id: '',
          creationTime: 0,
          source: 'INPUT' as const,
          derivations: [],
          depth: 0
        }),
        occurrenceTime: 0,
        derived: false
      });

      if (results.length >= limit) break;
    }

    return results;
  }
}