import { stopwatch, type ToolCapabilities, toolError, toSkillFeedback } from '@senars/util';
import type { ToolFeedbackObserver } from '@senars/util/feedback';
import { DefaultToolFeedbackObserver } from '@senars/util/feedback';
import type { ToolResult } from '../engine/Engine.js';

export type ToolFn = (
  args: Record<string, unknown>,
  correlationId?: string,
  signal?: AbortSignal
) => Promise<ToolResult> | ToolResult;

export type { ToolCapabilities };

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

interface RegistryTarget {
  register(spec: ToolSpec): void;
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
    for (const spec of this.#tools.values()) {
      if (!delegate.get(spec.name)) {
        delegate.register(spec);
      }
    }
    this.#tools.clear();
  }

  private target(): RegistryTarget {
    return (
      this.#delegate ?? {
        register: (spec) => void this.#tools.set(spec.name, spec),
        unregister: (name) => void this.#tools.delete(name),
        get: (name) => this.#tools.get(name),
        list: () => [...this.#tools.values()],
        execute: (name, args, correlationId, signal) =>
          this.executeLocal(name, args, correlationId, signal),
        getFeedback: (name) => {
          const fb = this.#feedbackObserver.getFeedback(name);
          return fb ? toSkillFeedback(fb) : undefined;
        },
        getAllFeedback: () => this.#feedbackObserver.getAllFeedback().map(toSkillFeedback),
        getRecentResults: (limit) => this.#feedbackObserver.getFeedbackString(limit),
        clear: () => {
          this.#tools.clear();
          this.#feedbackObserver.resetFeedback();
        },
      }
    );
  }

  register(spec: ToolSpec): void {
    this.target().register(spec);
  }

  unregister(name: string): void {
    this.target().unregister(name);
  }

  get(name: string): ToolSpec | undefined {
    return this.target().get(name);
  }

  list(): ToolSpec[] {
    return this.target().list();
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    correlationId?: string,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    if (signal?.aborted) {
      return toolError('Execution aborted');
    }
    return this.target().execute(name, args, correlationId, signal);
  }

  private async executeLocal(
    name: string,
    args: Record<string, unknown>,
    correlationId?: string,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    const tool = this.#tools.get(name);
    if (!tool) return toolError(`Unknown tool: ${name}`);

    const elapsed = stopwatch();
    try {
      const result = await tool.execute(args, correlationId, signal);
      this.#feedbackObserver.recordCall(name, result, elapsed());
      return result;
    } catch (err) {
      const result = toolError(err);
      this.#feedbackObserver.recordCall(name, result, elapsed());
      return result;
    }
  }

  getFeedback(name: string): SkillFeedback | undefined {
    return this.target().getFeedback(name);
  }

  getAllFeedback(): SkillFeedback[] {
    return this.target().getAllFeedback();
  }

  getRecentResults(limit: number): string {
    return this.target().getRecentResults(limit);
  }

  clear(): void {
    this.target().clear();
  }
}
