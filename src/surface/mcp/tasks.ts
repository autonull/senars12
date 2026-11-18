/**
 * MCP Tasks — long-running operation handles.
 *
 * No sessions; handles are log references. TTL/cacheScope lists; deterministic order.
 */

import type { MCPTask, MCPServer } from './types.js';

/** Task manager for MCP server. */
export class MCPTaskManager {
  private server: MCPServer;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(server: MCPServer) {
    this.server = server;
  }

  /** Start periodic cleanup. */
  startCleanup(intervalMs = 60000): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, intervalMs);
  }

  /** Stop periodic cleanup. */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /** Create a new task. */
  createTask(
    tool: string,
    arguments_: Record<string, unknown>,
    ttlMs = 300000
  ): MCPTask {
    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const task: MCPTask = {
      id,
      tool,
      arguments: arguments_,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ttlMs,
    };
    this.server.tasks.set(id, task);
    return task;
  }

  /** Get task by ID. */
  getTask(id: string): MCPTask | undefined {
    return this.server.tasks.get(id);
  }

  /** Update task status. */
  updateTask(
    id: string,
    updates: Partial<Pick<MCPTask, 'status' | 'result' | 'error'>>
  ): MCPTask | undefined {
    const task = this.server.tasks.get(id);
    if (!task) return undefined;

    const updated = { ...task, ...updates, updatedAt: Date.now() };
    this.server.tasks.set(id, updated);
    return updated;
  }

  /** Mark task as running. */
  startTask(id: string): MCPTask | undefined {
    return this.updateTask(id, { status: 'running' });
  }

  /** Mark task as completed. */
  completeTask(id: string, result: unknown): MCPTask | undefined {
    return this.updateTask(id, { status: 'completed', result });
  }

  /** Mark task as failed. */
  failTask(id: string, error: string): MCPTask | undefined {
    return this.updateTask(id, { status: 'failed', error });
  }

  /** List all tasks (with optional filter). */
  listTasks(filter?: { status?: MCPTask['status']; tool?: string }): MCPTask[] {
    this.cleanup();
    let tasks: MCPTask[] = Array.from(this.server.tasks.values());

    if (filter?.status) {
      tasks = tasks.filter(t => t.status === filter.status);
    }
    if (filter?.tool) {
      tasks = tasks.filter(t => t.tool === filter.tool);
    }

    // Deterministic order: by createdAt
    tasks.sort((a: MCPTask, b: MCPTask) => a.createdAt - b.createdAt);
    return tasks;
  }

  /** Clean expired tasks. */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, task] of this.server.tasks) {
      if (now - task.createdAt > task.ttlMs) {
        this.server.tasks.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }

  /** Get task statistics. */
  getStats(): { total: number; byStatus: Record<string, number>; byTool: Record<string, number> } {
    this.cleanup();
    const tasks: MCPTask[] = Array.from(this.server.tasks.values());
    const byStatus: Record<string, number> = {};
    const byTool: Record<string, number> = {};

    for (const task of tasks) {
      byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
      byTool[task.tool] = (byTool[task.tool] ?? 0) + 1;
    }

    return { total: tasks.length, byStatus, byTool };
  }
}

/** Create task manager. */
export function createTaskManager(server: MCPServer): MCPTaskManager {
  return new MCPTaskManager(server);
}

/** Task cache scope. */
export const TASK_CACHE_SCOPES = ['request', 'session', 'global'] as const;
export type TaskCacheScope = (typeof TASK_CACHE_SCOPES)[number];

/** Task TTL configuration. */
export interface TaskTTLConfig {
  /** Default TTL per tool. */
  default: Record<string, number>;
  /** Max TTL. */
  max: number;
  /** Min TTL. */
  min: number;
}

/** Default task TTL config. */
export const defaultTaskTTLConfig: TaskTTLConfig = {
  default: {
    'world.habitat.run': 60000,
    'world.pack.run': 300000,
    'logic.prove': 120000,
    'artifact.admit': 30000,
    'curriculum.generate': 120000,
  },
  max: 3600000, // 1 hour
  min: 10000, // 10 seconds
};

/** Get TTL for tool. */
export function getTaskTTL(tool: string, config: TaskTTLConfig = defaultTaskTTLConfig): number {
  return config.default[tool] ?? config.max;
}