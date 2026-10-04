import { deadline, maxBy, rankBy } from '@senars/util';

import type { GateRegistry } from '../kernel/GateRegistry.js';
import type { TaskAdmission } from '../memory/ports/index.js';
import type { Task } from '../types';

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
  /** Required (TODO19 F2, TODO33 §5.P2.7): the manager admits through the owner's gates. */
  gateRegistry: GateRegistry;
}

const DEFAULT_TIMEOUT_MS = 30000;

export class TaskManager {
  private pending = new Map<string, TaskWrapper>();
  private completed = new Map<string, TaskWrapper>();
  private failed = new Map<string, TaskWrapper>();
  private memory: TaskAdmission;
  private readonly defaultTimeout: number;
  private gates: GateRegistry;
  private timeouts = new Map<string, () => void>();

  constructor(memory: TaskAdmission, private readonly config: TaskManagerConfig) {
    this.memory = memory;
    this.defaultTimeout = config.defaultTimeout ?? DEFAULT_TIMEOUT_MS;
    this.gates = config.gateRegistry;
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

  /** Pending wrappers, highest priority first. */
  private byPriority(): TaskWrapper[] {
    return rankBy(this.pending.values(), (w) => w.priority);
  }

  peekTask(): Task | undefined {
    return maxBy([...this.pending.values()], (w) => w.priority)?.task;
  }

  /** All pending tasks, highest priority first. */
  getPending(): Task[] {
    return this.byPriority().map((w) => w.task);
  }

  /** Remove a pending task without marking it failed/expired (e.g. dispatched to tools). */
  removePending(taskId: string): boolean {
    const wrapper = this.pending.get(taskId);
    if (!wrapper) return false;
    this.pending.delete(taskId);
    this.disarm(taskId);
    return true;
  }

  addTask(task: Task, timeout?: number): void {
    const wrapper: TaskWrapper = {
      task,
      lifecycle: 'pending',
      createdAt: Date.now(),
      retries: 0,
      timeout: timeout ?? this.defaultTimeout,
      priority: task.budget.priority,
    };

    const taskId = task.stamp.id;
    this.pending.set(taskId, wrapper);

    if (wrapper.timeout && wrapper.timeout > 0) {
      this.timeouts.set(taskId, deadline(wrapper.timeout, () => this.expireTask(taskId)));
    }

  }

  async processPending(): Promise<Task[]> {
    const processed: Task[] = [];
    for (const wrapper of this.byPriority()) {
      if (wrapper.lifecycle !== 'pending') continue;

      if (!this.gates.getBudgetGate().check({ operation: 'memory-op', estimatedCost: 1 }).granted)
        break;

      const taskId = wrapper.task.stamp.id;
      this.disarm(taskId);

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
        wrapper.task.budget,
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

    this.disarm(taskId);
    return true;
  }

  getTask(taskId: string): TaskWrapper | undefined {
    return this.pending.get(taskId) ?? this.completed.get(taskId) ?? this.failed.get(taskId);
  }

  /** Cancel a task's expiry deadline. Safe once it has already fired. */
  private disarm(taskId: string): void {
    this.timeouts.get(taskId)?.();
    this.timeouts.delete(taskId);
  }

  clear(): void {
    for (const disarm of this.timeouts.values()) disarm();
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
}
