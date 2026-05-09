import type {Task} from './task.js';
import {getBudgetValue} from './task.js';
import {Memory} from '../memory';

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
}

const DEFAULT_CONFIG: Required<TaskManagerConfig> = {
    defaultTimeout: 30000,
    maxRetries: 3,
    retryBackoffMs: 1000,
    enablePriorityScheduling: true
};

export class TaskManager {
    private pending = new Map<string, TaskWrapper>();
    private running = new Map<string, TaskWrapper>();
    private completed = new Map<string, TaskWrapper>();
    private failed = new Map<string, TaskWrapper>();
    private memory: Memory;
    private config: Required<TaskManagerConfig>;
    private timeouts: Map<string, NodeJS.Timeout>;

    constructor(memory: Memory, config: TaskManagerConfig = {}) {
        this.memory = memory;
        this.config = {...DEFAULT_CONFIG, ...config};
        this.timeouts = new Map();
    }

    get size(): number {
        return this.pending.size + this.running.size;
    }

    get stats() {
        return {
            pending: this.pending.size,
            running: this.running.size,
            completed: this.completed.size,
            failed: this.failed.size
        };
    }

    addTask(task: Task, timeout?: number): void {
        const priority = typeof task.budget === 'number' ? task.budget : task.budget.priority;
        const wrapper: TaskWrapper = {
            task,
            lifecycle: 'pending',
            createdAt: Date.now(),
            retries: 0,
            timeout: timeout ?? this.config.defaultTimeout,
            priority
        };

        const taskId = task.stamp.id;
        this.pending.set(taskId, wrapper);

        if (wrapper.timeout && wrapper.timeout > 0) {
            const timeoutId = setTimeout(() => {
                this.expireTask(taskId);
            }, wrapper.timeout);
            this.timeouts.set(taskId, timeoutId);
        }

        if (this.config.enablePriorityScheduling) {
            this.reschedulePending();
        }
    }

    async processPending(): Promise<Task[]> {
        const processed: Task[] = [];
        const pendingArray = Array.from(this.pending.values());

        if (this.config.enablePriorityScheduling) {
            pendingArray.sort((a, b) => b.priority - a.priority);
        }

        for (const wrapper of pendingArray) {
            const taskId = wrapper.task.stamp.id;

            if (wrapper.lifecycle === 'expired' || wrapper.lifecycle === 'failed') {
                continue;
            }

            try {
                wrapper.lifecycle = 'running';
                wrapper.startedAt = Date.now();
                this.running.set(taskId, wrapper);
                this.pending.delete(taskId);

                if (this.memory.addTask(wrapper.task.term, wrapper.task.type, wrapper.task.truth, getBudgetValue(wrapper.task.budget))) {
                    wrapper.lifecycle = 'completed';
                    wrapper.completedAt = Date.now();
                    processed.push(wrapper.task);
                    this.completed.set(taskId, wrapper);
                } else {
                    throw new Error('Failed to add task to memory');
                }
            } catch (error) {
                await this.handleTaskFailure(taskId, error);
            } finally {
                const timeoutId = this.timeouts.get(taskId);
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    this.timeouts.delete(taskId);
                }

                if (wrapper.lifecycle === 'running') {
                    wrapper.lifecycle = 'pending';
                    this.pending.set(taskId, wrapper);
                    this.running.delete(taskId);
                }
            }
        }

        return processed;
    }

    cancelTask(taskId: string): boolean {
        const wrapper = this.pending.get(taskId) || this.running.get(taskId);
        if (wrapper) {
            wrapper.lifecycle = 'failed';
            wrapper.completedAt = Date.now();
            this.pending.delete(taskId);
            this.running.delete(taskId);
            this.failed.set(taskId, wrapper);

            const timeoutId = this.timeouts.get(taskId);
            if (timeoutId) {
                clearTimeout(timeoutId);
                this.timeouts.delete(taskId);
            }

            return true;
        }
        return false;
    }

    getTask(taskId: string): TaskWrapper | undefined {
        return this.pending.get(taskId) || this.running.get(taskId) || this.completed.get(taskId) || this.failed.get(taskId);
    }

    clear(): void {
        for (const timeoutId of this.timeouts.values()) {
            clearTimeout(timeoutId);
        }
        this.timeouts.clear();
        this.pending.clear();
        this.running.clear();
        this.completed.clear();
        this.failed.clear();
    }

    private async handleTaskFailure(taskId: string, _error: any): Promise<void> {
        const wrapper = this.pending.get(taskId) || this.running.get(taskId);
        if (!wrapper) return;

        const timeoutId = this.timeouts.get(taskId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.timeouts.delete(taskId);
        }

        if (wrapper.retries < this.config.maxRetries) {
            wrapper.retries++;
            wrapper.lifecycle = 'pending';

            const backoffDelay = this.config.retryBackoffMs * Math.pow(2, wrapper.retries);
            setTimeout(() => {
                if (this.pending.has(taskId)) {
                    this.pending.get(taskId)!.retries = wrapper.retries;
                }
            }, backoffDelay);
        } else {
            wrapper.lifecycle = 'failed';
            wrapper.completedAt = Date.now();
            this.failed.set(taskId, wrapper);
            this.running.delete(taskId);
            this.pending.delete(taskId);
        }
    }

    private expireTask(taskId: string): void {
        const wrapper = this.pending.get(taskId) || this.running.get(taskId);
        if (wrapper) {
            wrapper.lifecycle = 'expired';
            wrapper.completedAt = Date.now();
            this.pending.delete(taskId);
            this.running.delete(taskId);
        }
    }

    private reschedulePending(): void {
        const pendingArray = Array.from(this.pending.values());
        pendingArray.sort((a, b) => b.priority - a.priority);

        this.pending.clear();
        for (const wrapper of pendingArray) {
            this.pending.set(wrapper.task.stamp.id, wrapper);
        }
    }
}