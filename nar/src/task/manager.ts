import { type GateRegistry, gateRegistry } from '../kernel/GateRegistry.js';
import type { Memory } from '../memory';
import type { Budget, Task } from '../types';

export type TaskLifecycle = 'pending' | 'running' | 'completed' | 'failed' | 'expired';

export interface TaskWrapper {
  task: Task;
  lifecycle: TaskLifecycle;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  retries: number;
  timeout?: number;
  priority: number;
}

export interface TaskManagerConfig {
  defaultTimeout?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
  enablePriorityScheduling?: boolean;
  /** TODO19 F2: per-instance gate registry (defaults to the process-global singleton). */
  gateRegistry?: GateRegistry;
}

const DEFAULT_CONFIG: Omit<Required<TaskManagerConfig>, 'gateRegistry'> = {
  defaultTimeout: 30000,
  maxRetries: 3,
  retryBackoffMs: 1000,
  enablePriorityScheduling: true,
};

export class TaskManager {
  private pending = new Map<string, TaskWrapper>();
  private completed = new Map<string, TaskWrapper>();
  private failed = new Map<string, TaskWrapper>();
  private memory: Memory;
  private config: Required<TaskManagerConfig>;
  private gates: GateRegistry;
  private timeouts = new Map<string, NodeJS.Timeout>();

  constructor(memory: Memory, config: TaskManagerConfig = {}) {
    this.memory = memory;
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<TaskManagerConfig>;
    this.gates = config.gateRegistry ?? gateRegistry;
  }

  get size(): number {
    return this.pending.size;
  }

  get stats() {
    return {
      pending: this.pending.size,
      completed: this.completed.size,
      failed: this.failed.size,
    };
  }

  peekTask(): Task | undefined {
    const pending = [...this.pending.values()].sort((a, b) => b.priority - a.priority);
    return pending[0]?.task;
  }

  /** All pending tasks, highest priority first. */
  getPending(): Task[] {
    return [...this.pending.values()].sort((a, b) => b.priority - a.priority).map((w) => w.task);
  }

  /** Remove a pending task without marking it failed/expired (e.g. dispatched to tools). */
  removePending(taskId: string): boolean {
    const wrapper = this.pending.get(taskId);
    if (!wrapper) return false;
    this.pending.delete(taskId);
    const timeoutId = this.timeouts.get(taskId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(taskId);
    }
    return true;
  }

  addTask(task: Task, timeout?: number): void {
    const wrapper: TaskWrapper = {
      task,
      lifecycle: 'pending',
      createdAt: Date.now(),
      retries: 0,
      timeout: timeout ?? this.config.defaultTimeout,
      priority: typeof task.budget === 'number' ? task.budget : task.budget.priority,
    };

    const taskId = task.stamp.id;
    this.pending.set(taskId, wrapper);

    if (wrapper.timeout && wrapper.timeout > 0) {
      const id = setTimeout(() => this.expireTask(taskId), wrapper.timeout);
      this.timeouts.set(taskId, id);
    }

    if (this.config.enablePriorityScheduling) this.reschedulePending();
  }

  async processPending(): Promise<Task[]> {
    const processed: Task[] = [];
    const items = [...this.pending.values()].sort((a, b) => b.priority - a.priority);

    for (const wrapper of items) {
      if (wrapper.lifecycle !== 'pending') continue;

      if (!this.gates.getBudgetGate().check({ operation: 'memory-op', estimatedCost: 1 }).granted)
        break;

      const taskId = wrapper.task.stamp.id;
      const timeoutId = this.timeouts.get(taskId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.timeouts.delete(taskId);
      }

      wrapper.lifecycle = 'running';
      wrapper.startedAt = Date.now();

      const gate = this.gates.getPerceptionGate();
      const result = gate.admitTask(
        wrapper.task.term,
        wrapper.task.type,
        wrapper.task.truth,
        'task-manager',
        taskId
      );

      if (!result.admitted) {
        wrapper.lifecycle = 'failed';
        wrapper.completedAt = Date.now();
        this.failed.set(taskId, wrapper);
        this.pending.delete(taskId);
        continue;
      }

      const added = this.memory.addTask(
        wrapper.task.term,
        wrapper.task.type,
        wrapper.task.truth,
        wrapper.task.budget as Budget,
        wrapper.task.stamp
      );

      if (added) {
        wrapper.lifecycle = 'completed';
        wrapper.completedAt = Date.now();
        processed.push(wrapper.task);
        this.completed.set(taskId, wrapper);
        this.pending.delete(taskId);
      } else {
        wrapper.lifecycle = 'failed';
        wrapper.completedAt = Date.now();
        this.failed.set(taskId, wrapper);
        this.pending.delete(taskId);
      }
    }

    return processed;
  }

  cancelTask(taskId: string): boolean {
    const wrapper = this.pending.get(taskId);
    if (!wrapper) return false;

    wrapper.lifecycle = 'failed';
    wrapper.completedAt = Date.now();
    this.pending.delete(taskId);
    this.failed.set(taskId, wrapper);

    const timeoutId = this.timeouts.get(taskId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(taskId);
    }
    return true;
  }

  getTask(taskId: string): TaskWrapper | undefined {
    return this.pending.get(taskId) ?? this.completed.get(taskId) ?? this.failed.get(taskId);
  }

  clear(): void {
    for (const id of this.timeouts.values()) clearTimeout(id);
    this.timeouts.clear();
    this.pending.clear();
    this.completed.clear();
    this.failed.clear();
  }

  private expireTask(taskId: string): void {
    const wrapper = this.pending.get(taskId);
    if (!wrapper) return;

    wrapper.lifecycle = 'expired';
    wrapper.completedAt = Date.now();
    this.pending.delete(taskId);
    this.failed.set(taskId, wrapper);
  }

  private reschedulePending(): void {
    const items = [...this.pending.values()].sort((a, b) => b.priority - a.priority);
    this.pending.clear();
    for (const w of items) this.pending.set(w.task.stamp.id, w);
  }
}
