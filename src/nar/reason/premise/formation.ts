import type {Memory} from '../../memory';
import type {Task} from '../../types';
import {createSecondaryTask} from '../../types';
import {termsEqual} from '../../terms';
import {samplePremises} from './sample.js';

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
    private readonly recentPairs = new Set<string>();
    private readonly maxRecentPairs = 500;

    constructor(private readonly config: Partial<PremiseConfig> = {}) {
    }

    formPremises(task: Task, memory: Memory, selector: PremiseSelector): Task[] {
        const premises = selector.select(task, memory, 20);
        const filtered = premises.filter(p => {
            if (!this.checkQuality(p)) return false;
            if (!this.checkDiversity(task, p)) return false;
            return this.applyFilters(p, memory);
        });
        return filtered;
    }

    clearDiversityCache(): void {
        this.recentPairs.clear();
    }

    private checkQuality(premise: Task): boolean {
        const threshold = this.config.qualityThreshold ?? 0;
        const quality = premise.truth?.f ?? 0.5;
        return quality >= threshold;
    }

  private checkDiversity(primary: Task, secondary: Task): boolean {
    const primaryStr = primary.term.kind === 'atom' ? primary.term.symbol : primary.term.kind;
    const secondaryStr = secondary.term.kind === 'atom' ? secondary.term.symbol : secondary.term.kind;
    const pairKey = `${primaryStr}-${secondaryStr}`;
    const reverseKey = `${secondaryStr}-${primaryStr}`;

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
}

export class TermMatchingSelector implements PremiseSelector {
    readonly name = 'term-matching';

    constructor(private readonly sampleSize = 20) {
    }

    select(task: Task, memory: Memory, limit = 10): Task[] {
        return samplePremises(memory, task, {
            sampleSize: this.sampleSize,
            limit,
            filter: (concept, task) => !termsEqual(concept.term, task.term)
        });
    }
}

export class DecompositionSelector implements PremiseSelector {
    readonly name = 'decomposition';

    select(task: Task, memory: Memory, limit = 10): Task[] {
        if (task.term.kind !== 'conjunction') {
            return [];
        }

        const results: Task[] = [];
        for (const arg of task.term.args ?? []) {
            const concept = memory.getConcept(arg);
            if (!concept) continue;

            const belief = concept.beliefBag.peek();
            if (!belief?.truth) continue;

            results.push(createSecondaryTask(arg, concept.priority, belief.truth));
            if (results.length >= limit) break;
        }

        return results;
    }
}

export class AnalogySelector implements PremiseSelector {
    readonly name = 'analogy';

    constructor(private readonly sampleSize = 15) {
    }

    select(task: Task, memory: Memory, limit = 5): Task[] {
        return samplePremises(memory, task, {
            sampleSize: this.sampleSize,
            limit,
            filter: (concept, task) => {
                if (termsEqual(concept.term, task.term)) return false;
                if (concept.term.kind !== 'inheritance') return false;

                if (task.term.kind === 'inheritance') {
                    const taskSub = task.term.args?.[0];
                    const taskPred = task.term.args?.[1];
                    const conceptSub = concept.term.args?.[0];
                    const conceptPred = concept.term.args?.[1];

                    const hasOverlap =
                        (taskSub && conceptSub && termsEqual(taskSub, conceptSub)) ||
                        (taskSub && conceptPred && termsEqual(taskSub, conceptPred)) ||
                        (taskPred && conceptSub && termsEqual(taskPred, conceptSub)) ||
                        (taskPred && conceptPred && termsEqual(taskPred, conceptPred));

                    if (!hasOverlap) return false;
                }

                return true;
            }
        });
    }
}
