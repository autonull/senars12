/**
 * Memory serialization with versioning
 */

import type { Term } from '../../terms';
import { TermBuilder } from '../../terms';
import type { Bag } from '../bag.js';
import type { TaskData } from '../concept.js';
import type { Memory } from '../memory.js';

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
}

export const MEMORY_VERSION = 1;

export const V1 = {
  version: MEMORY_VERSION,
  serialize,
  deserialize,
  validate,
  repair,
} as const;

export function serialize(memory: Memory): SerializedMemory {
  const concepts: SerializedConcept[] = [];

  for (const concept of memory.listConcepts()) {
    concepts.push({
      term: termToString(concept.term),
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

function termToString(term: Term): string {
  if (!term) return 'unknown';
  try {
    // system boundary — term structure varies across memory versions
    return term.kind === 'atom' ? term.symbol : term.kind;
  } catch {
    return term.kind;
  }
}

export type BagItemWithMeta = {
  term: Term;
  truth?: { f: number; c: number };
  budget: number;
  meta: { priority: number; lastAccess: number; createdAt: number };
};

function serializeBag(bag: Bag<TaskData>): SerializedTask[] {
  const tasks: SerializedTask[] = [];

  for (const [item, priority] of bag.entries()) {
    tasks.push({
      term: termToString(item.term),
      truth: item.truth ? { f: item.truth.f, c: item.truth.c } : undefined,
      budget: item.budget.priority ?? priority,
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
      const term = TermBuilder.atom(serialized.term);
      memory.addConcept(term);
    } catch {
      // expected: individual concept deserialization failure shouldn't abort memory load
      console.warn(`Failed to deserialize concept: ${serialized.term}`);
    }
  }
}

export function validate(data: Partial<SerializedMemory>): boolean {
  if (!data.version || !data.concepts || !data.statistics) return false;
  if (data.version !== MEMORY_VERSION) return false;
  if (!Array.isArray(data.concepts)) return false;

  for (const concept of data.concepts) {
    if (!concept.term || typeof concept.priority !== 'number') return false;
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
