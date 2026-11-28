/**
 * Procedural Fold — task bags and procedural memory operations.
 */
import { type Term } from '../../terms';
import { Stamp } from '../../terms';
import type { Budget, Task, TaskType } from '../../types';
import { Concept } from '../concept';
import type { TaskProjection, ConceptProjection } from './episodic';
import type { TaskData } from '../concept';
import type { Belief, Question } from '../view';
/** Procedural view over task bags. */
export declare class ProceduralFold {
    #private;
    constructor(tasks: Map<string, TaskProjection[]>, concepts: Map<string, ConceptProjection>, clock: () => number);
    /** Add a task to a concept's bag. */
    addTask(term: Term, type: TaskType, truth?: any, budget?: Budget, stamp?: Stamp): boolean;
    /** Get beliefs for a concept. */
    beliefs(concept: Concept): TaskData[];
    /** Get task count for a concept. */
    taskCount(concept: Concept): number;
    /** Get all goals. */
    getGoals(): Task[];
    /** Get all beliefs. */
    getBeliefs(): Belief[];
    /** Get all questions. */
    getQuestions(): Question[];
    /** Get tasks for a concept. */
    getTasks(term: Term): TaskData[];
    /** Get all tasks across all concepts. */
    getAllTasks(): TaskData[];
}
//# sourceMappingURL=procedural.d.ts.map