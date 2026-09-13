import type { ToolFeedbackObserver } from '@senars/util/feedback';
import { DefaultToolFeedbackObserver } from '@senars/util/feedback';
import type { ToolResult } from '../engine/Engine.js';

export type ToolFn = (
  args: Record<string, unknown>,
  correlationId?: string,
  signal?: AbortSignal
) => Promise<ToolResult> | ToolResult;

export interface ToolCapabilities {
  pure?: boolean;
  idempotent?: boolean;
  readOnly?: boolean;
  requiresPermissions?: string[];
  timeout?: number;
  maxConcurrency?: number;
}

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON schema (object type with properties/required) — matches nar's `Tool` contract */
  parameters: Record<string, unknown>;
  capabilities?: ToolCapabilities;
  tags?: string[];
  execute: ToolFn;
}

export interface SkillFeedback {
  skill: string;
  lastResult: string;
  successRate: number;
  callCount: number;
  lastError?: string;
}

/** Delegate interface for the unified tool registry (nar's ToolManager). */
export interface ToolRegistryDelegate {
  register(tool: ToolSpec): void;
  unregister(name: string): void;
  get(name: string): ToolSpec | undefined;
  list(): ToolSpec[];
  execute(
    name: string,
    args: Record<string, unknown>,
    correlationId?: string,
    signal?: AbortSignal
  ): Promise<ToolResult>;
  getFeedback(name: string): SkillFeedback | undefined;
  getAllFeedback(): SkillFeedback[];
  getRecentResults(limit: number): string;
  clear(): void;
}

export class ToolRegistry {
  #tools = new Map<string, ToolSpec>();
  #feedbackObserver: ToolFeedbackObserver;
  #delegate?: ToolRegistryDelegate;

  constructor(feedbackObserver?: ToolFeedbackObserver, delegate?: ToolRegistryDelegate) {
    this.#feedbackObserver = feedbackObserver ?? new DefaultToolFeedbackObserver();
    this.#delegate = delegate;
  }

  /** Set the delegate registry (e.g., nar's ToolManager) after construction. */
  setDelegate(delegate: ToolRegistryDelegate): void {
    this.#delegate = delegate;
    // Sync existing tools to delegate
    for (const spec of this.#tools.values()) {
      if (!delegate.get(spec.name)) {
        delegate.register(spec);
      }
    }
    // Clear local map since delegate is now authoritative
    this.#tools.clear();
  }

  register(spec: ToolSpec): void {
    if (this.#delegate) {
      this.#delegate.register(spec);
    } else {
      this.#tools.set(spec.name, spec);
    }
  }

  unregister(name: string): void {
    if (this.#delegate) {
      this.#delegate.unregister(name);
    } else {
      this.#tools.delete(name);
    }
  }

  get(name: string): ToolSpec | undefined {
    if (this.#delegate) {
      return this.#delegate.get(name);
    }
    return this.#tools.get(name);
  }

  list(): ToolSpec[] {
    if (this.#delegate) {
      return this.#delegate.list();
    }
    return [...this.#tools.values()];
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    correlationId?: string,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    if (signal?.aborted) {
      return { success: false, content: null, error: 'Execution aborted' };
    }
    if (this.#delegate) {
      return this.#delegate.execute(name, args, correlationId, signal);
    }
    const tool = this.#tools.get(name);
    if (!tool) return { success: false, content: null, error: `Unknown tool: ${name}` };

    const start = Date.now();
    try {
      const result = await tool.execute(args, correlationId, signal);
      const duration = Date.now() - start;
      this.#feedbackObserver.recordCall(name, result, duration);
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      const result = { success: false, content: null, error: (err as Error).message };
      this.#feedbackObserver.recordCall(name, result, duration);
      return result;
    }
  }

  getFeedback(name: string): SkillFeedback | undefined {
    if (this.#delegate) {
      return this.#delegate.getFeedback(name);
    }
    const fb = this.#feedbackObserver.getFeedback(name);
    if (!fb) return undefined;
    return {
      skill: fb.name,
      lastResult: fb.lastResult,
      successRate: fb.successRate,
      callCount: fb.totalCalls,
      lastError: fb.lastError,
    };
  }

  getAllFeedback(): SkillFeedback[] {
    if (this.#delegate) {
      return this.#delegate.getAllFeedback();
    }
    return this.#feedbackObserver.getAllFeedback().map((fb) => ({
      skill: fb.name,
      lastResult: fb.lastResult,
      successRate: fb.successRate,
      callCount: fb.totalCalls,
      lastError: fb.lastError,
    }));
  }

  getRecentResults(limit: number): string {
    if (this.#delegate) {
      return this.#delegate.getRecentResults(limit);
    }
    return this.#feedbackObserver.getFeedbackString(limit);
  }

  clear(): void {
    if (this.#delegate) {
      this.#delegate.clear();
    } else {
      this.#tools.clear();
      this.#feedbackObserver.resetFeedback();
    }
  }
}
