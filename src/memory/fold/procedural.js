/**
 * Procedural Fold — task bags and procedural memory operations.
 */
import { termKey } from '../../terms';
import { Truth } from '../../terms';
import { Stamp } from '../../terms';
import { NEUTRAL_BUDGET } from '../../types';
import { taskFromBagItem } from '../concept';
/** Procedural view over task bags. */
export class ProceduralFold {
    #tasks = new Map();
    #concepts;
    #clock;
    constructor(tasks, concepts, clock) {
        this.#tasks = tasks;
        this.#concepts = concepts;
        this.#clock = clock;
    }
    /** Add a task to a concept's bag. */
    addTask(term, type, truth, budget, stamp) {
        const concept = this.#concepts.get(termKey(term));
        if (!concept)
            return false;
        const taskData = {
            id: stamp?.id ?? `task-${this.#clock()}`,
            priority: budget?.priority ?? 0,
            term,
            truth: truth ?? Truth.NEUTRAL,
            budget: budget ?? NEUTRAL_BUDGET,
            stamp: stamp ?? Stamp.createInput(),
            createdAt: this.#clock(),
        };
        concept.concept.addTask(type, taskData);
        const conceptTasks = this.#tasks.get(termKey(term)) ?? [];
        conceptTasks.push({
            conceptTerm: termKey(term),
            task: taskData,
            admittedAt: this.#clock(),
        });
        this.#tasks.set(termKey(term), conceptTasks);
        return true;
    }
    /** Get beliefs for a concept. */
    beliefs(concept) {
        return concept.getBeliefs();
    }
    /** Get task count for a concept. */
    taskCount(concept) {
        return concept.totalTasks;
    }
    /** Get all goals. */
    getGoals() {
        const goals = [];
        for (const c of this.#concepts.values()) {
            if (!c.isArchived) {
                for (const belief of c.concept.getGoals()) {
                    goals.push(taskFromBagItem(belief, 'goal', c.concept.priority));
                }
            }
        }
        return goals;
    }
    /** Get all beliefs. */
    getBeliefs() {
        const beliefs = [];
        for (const c of this.#concepts.values()) {
            if (!c.isArchived) {
                for (const belief of c.concept.getBeliefs()) {
                    beliefs.push(taskFromBagItem(belief, 'belief', c.concept.priority));
                }
            }
        }
        return beliefs;
    }
    /** Get all questions. */
    getQuestions() {
        const questions = [];
        for (const c of this.#concepts.values()) {
            if (!c.isArchived) {
                for (const question of c.concept.getQuestions()) {
                    questions.push(taskFromBagItem(question, 'question', c.concept.priority));
                }
            }
        }
        return questions;
    }
    /** Get tasks for a concept. */
    getTasks(term) {
        const key = termKey(term);
        const projections = this.#tasks.get(key);
        return projections?.map((p) => p.task) ?? [];
    }
    /** Get all tasks across all concepts. */
    getAllTasks() {
        const allTasks = [];
        for (const projections of this.#tasks.values()) {
            for (const p of projections) {
                allTasks.push(p.task);
            }
        }
        return allTasks;
    }
}
