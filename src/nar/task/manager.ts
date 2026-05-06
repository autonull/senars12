import type { Task } from './task.js';
import { Memory } from '../memory/memory.js';
import { getBudgetValue } from './task.js';

export class TaskManager {
  private pending = new Map<string, Task>();
  private memory: Memory;

  constructor(memory: Memory) { this.memory = memory; }

  addTask(task: Task): void { this.pending.set(task.stamp.id, task); }

  processPending(): Task[] {
    const processed: Task[] = [];
    for (const task of this.pending.values()) {
      if (this.memory.addTask(task.term, task.type, task.truth, getBudgetValue(task.budget))) {
        processed.push(task);
      }
    }
    this.pending.clear();
    return processed;
  }

  get size(): number { return this.pending.size; }
}