/**
 * Memory serialization.
 *
 * Full round-trip: Narsese terms, truth, budget priority, concept priorities,
 * and stamps. Restored stamp IDs re-seed the atomic counter (see
 * observeStampId), so newly minted stamps never collide with reloaded ones.
 *
 * No version migration is kept: there are no persisted dumps in the wild yet,
 * so the format is versioned (version 1) but has a single reader/writer.
 */

import type {Stamp, Term} from '../../terms';
import {
    deserializeStamp,
    serializeStamp,
    Stamp as StampFactory,
    termParser,
    Truth,
} from '../../terms';
import type {SerializedStamp} from '../../terms';
import {createBudget} from '../../types';
import type {Bag} from '../bag.js';
import type {Concept, ConceptTaskType} from '../concept.js';
import type {TaskData} from '../concept.js';
import type {Memory} from '../memory.js';

export interface SerializedMemory {
    version: number;
    timestamp: number;
    concepts: SerializedConcept[];
    statistics: {
        totalConcepts: number;
        totalTasks: number;
    };
}

export interface SerializedConcept {
    term: string;
    priority: number;
    beliefs: SerializedTask[];
    goals: SerializedTask[];
    questions: SerializedTask[];
}

export interface SerializedTask {
    term: string;
    truth?: { f: number; c: number };
    budget: number;
    stamp?: SerializedStamp;
}

export const MEMORY_VERSION = 1;

type TaskTypeName = 'belief' | 'goal' | 'question';

export function serialize(memory: Memory): SerializedMemory {
    const concepts: SerializedConcept[] = [];

    for (const concept of memory.listConcepts()) {
        concepts.push({
            term: concept.term.toString(),
            priority: concept.priority,
            beliefs: serializeBag(concept.beliefBag),
            goals: serializeBag(concept.goalBag),
            questions: serializeBag(concept.questionBag),
        });
    }

    const stats = memory.getStatistics();

    return {
        version: MEMORY_VERSION,
        timestamp: Date.now(),
        concepts,
        statistics: {
            totalConcepts: stats.totalConcepts,
            totalTasks: stats.totalTasks,
        },
    };
}

function serializeBag(bag: Bag<TaskData>): SerializedTask[] {
    const tasks: SerializedTask[] = [];

    for (const [item, priority] of bag.entries()) {
        tasks.push({
            term: item.term.toString(),
            truth: item.truth ? {f: item.truth.f, c: item.truth.c} : undefined,
            budget: item.budget.priority ?? priority,
            stamp: item.stamp ? serializeStamp(item.stamp) : undefined,
        });
    }
    return tasks;
}

export async function deserialize(data: SerializedMemory, memory: Memory): Promise<void> {
    if (data.version !== MEMORY_VERSION) {
        throw new Error(`Unsupported memory version: ${data.version}`);
    }

    memory.clear();

    for (const serialized of data.concepts) {
        try {
            const term = termParser.parse(serialized.term);
            const concept = memory.addConcept(term);
            restoreBag(concept, 'belief', serialized.beliefs);
            restoreBag(concept, 'goal', serialized.goals);
            restoreBag(concept, 'question', serialized.questions);
            // Last: task restore bumps priority via recordAccess; the dump wins.
            if (typeof serialized.priority === 'number') concept.priority = serialized.priority;
        } catch {
            // expected: individual concept deserialization failure shouldn't abort memory load
            console.warn(`Failed to deserialize concept: ${serialized.term}`);
        }
    }
}

function restoreBag(concept: Concept, type: TaskTypeName, tasks?: SerializedTask[]): void {
    if (!tasks) return;
    for (const task of tasks) {
        try {
            const term = termParser.parse(task.term);
            const truth = task.truth ? Truth.create(task.truth.f, task.truth.c) : undefined;
            const budget = createBudget(typeof task.budget === 'number' ? task.budget : 0.5);
            const stamp: Stamp = task.stamp ? deserializeStamp(task.stamp) : StampFactory.createInput();
            concept.addTask(type as ConceptTaskType, {term, truth, budget, stamp});
        } catch {
            // expected: individual task deserialization failure shouldn't abort concept load
            console.warn(`Failed to deserialize task: ${task.term}`);
        }
    }
}

export function validate(data: Partial<SerializedMemory>): boolean {
    if (!data.version || !data.concepts || !data.statistics) return false;
    if (data.version !== MEMORY_VERSION) return false;
    if (!Array.isArray(data.concepts)) return false;

    for (const concept of data.concepts) {
        if (!concept.term || typeof concept.priority !== 'number') return false;
        for (const bag of [concept.beliefs, concept.goals, concept.questions]) {
            if (!bag) continue;
            if (!Array.isArray(bag)) return false;
            for (const task of bag) {
                if (!task.term) return false;
                if (
                    task.stamp &&
                    (typeof task.stamp.id !== 'string' || !Array.isArray(task.stamp.derivations))
                ) {
                    return false;
                }
            }
        }
    }

    return true;
}

export function repair(data: Partial<SerializedMemory>): SerializedMemory | null {
    try {
        if (!data.version) data.version = MEMORY_VERSION;
        if (!data.concepts) data.concepts = [];
        if (!data.statistics) {
            data.statistics = {
                totalConcepts: data.concepts?.length || 0,
                totalTasks: 0,
            };
        }
        if (!data.timestamp) data.timestamp = Date.now();

        if (validate(data)) {
            return data as SerializedMemory;
        }
    } catch {
        // expected: repair is best-effort; returns null on failure
        console.warn('Failed to repair memory data');
    }

    return null;
}
