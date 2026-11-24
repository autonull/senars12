/**
 * Procedural Fold — task bags and procedural memory operations.
 */

import { type Term, termKey } from '../../terms';
import { Truth } from '../../terms';
import { Stamp } from '../../terms';
import { atom } from '../../terms/impls/factory';
import type { Budget, Task, TaskType } from '../../types';
import { NEUTRAL_BUDGET } from '../../types';
import { Concept } from '../concept';
import type { TaskProjection, ConceptProjection } from './episodic';
import type { TaskData } from '../concept';
import type { Belief, Question, MemoryStats } from '../view';
import { taskFromBagItem } from '../concept';

/** Procedural view over task bags. */
export class ProceduralFold {
  readonly #tasks: Map<string, TaskProjection[]> = new Map();
  readonly #concepts: Map<string, ConceptProjection>;
  readonly #clock: () => number;

  constructor(
    tasks: Map<string, TaskProjection[]>,
    concepts: Map<string, ConceptProjection>,
    clock: () => number
  ) {
    this.#tasks = tasks;
    this.#concepts = concepts;
    this.#clock = clock;
  }

  /** Add a task to a concept's bag. */
  addTask(
    term: Term,
    type: TaskType,
    truth?: any,
    budget?: Budget,
    stamp?: Stamp
  ): boolean {
    const concept = this.#concepts.get(termKey(term));
    if (!concept) return false;

    const taskData = {
      id: stamp?.id ?? `task-${this.#clock()}`,
      priority: budget?.priority ?? 0,
      term,
      truth: truth ?? Truth.NEUTRAL,
      budget: budget ?? NEUTRAL_BUDGET,
      stamp: stamp ?? Stamp.createInput(),
      createdAt: this.#clock(),
    } as TaskData;

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
  beliefs(concept: Concept): TaskData[] {
    return concept.getBeliefs();
  }

  /** Get task count for a concept. */
  taskCount(concept: Concept): number {
    return concept.totalTasks;
  }

  /** Get all goals. */
  getGoals(): Task[] {
    const goals: Task[] = [];
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
  getBeliefs(): Belief[] {
    const beliefs: Belief[] = [];
    for (const c of this.#concepts.values()) {
      if (!c.isArchived) {
        for (const belief of c.concept.getBeliefs()) {
          beliefs.push(taskFromBagItem(belief, 'belief', c.concept.priority) as Belief);
        }
      }
    }
    return beliefs;
  }

  /** Get all questions. */
  getQuestions(): Question[] {
    const questions: Question[] = [];
    for (const c of this.#concepts.values()) {
      if (!c.isArchived) {
        for (const question of c.concept.getQuestions()) {
          questions.push(taskFromBagItem(question, 'question', c.concept.priority) as Question);
        }
      }
    }
    return questions;
  }

  /** Get tasks for a concept. */
  getTasks(term: Term): TaskData[] {
    const key = termKey(term);
    const projections = this.#tasks.get(key);
    return projections?.map((p) => p.task) ?? [];
  }

  /** Get all tasks across all concepts. */
  getAllTasks(): TaskData[] {
    const allTasks: TaskData[] = [];
    for (const projections of this.#tasks.values()) {
      for (const p of projections) {
        allTasks.push(p.task);
      }
    }
    return allTasks;
  }
}

// Type imports
import { nextInt, type RandomSource } from '@senars/util/random';