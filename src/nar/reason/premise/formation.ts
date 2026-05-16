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
