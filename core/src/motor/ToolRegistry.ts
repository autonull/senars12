import {
  stopwatch,
  type ToolCapabilities,
  type ToolContext,
  type ToolFn,
  type ToolSpec,
  toolError,
  type ToolResult,
  toSkillFeedback,
} from '@senars/util';
import type { SkillFeedback, ToolFeedbackObserver } from '@senars/util/feedback';
import { DefaultToolFeedbackObserver } from '@senars/util/feedback';

/**
 * The feedback shape is util's: the observer that produces it and the mapping
 * onto it already live there, and this file was carrying a second, field-for-
 * field identical declaration of it. Two copies of a five-field record that a
 * tool result crosses on every call is two places to forget a field.
 */
export type { SkillFeedback };

/**
 * The tool contract is util's too. It was declared here *and* in nar's tools
 * module with the same five fields and two different `execute` signatures — one
 * taking `(correlationId, signal)`, the other a `ToolContext` — so crossing the
 * delegation seam cost a hand-written mapping in both directions plus two casts
 * over `parameters`. A call now carries its provenance and cancellation in the
 * context, so the two registries speak one type and the adapter adapts a call.
 */
export type { ToolCapabilities, ToolContext, ToolFn, ToolSpec };

/** Delegate interface for the unified tool registry (nar's ToolManager). */
export interface ToolRegistryDelegate {
  register(tool: ToolSpec): void;
  unregister(name: string): void;
  get(name: string): ToolSpec | undefined;
  list(): ToolSpec[];
  execute(name: string, args: Record<string, unknown>, context?: ToolContext): Promise<ToolResult>;
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

  private target(): ToolRegistryDelegate {
    return (
      this.#delegate ?? {
        register: (spec) => void this.#tools.set(spec.name, spec),
        unregister: (name) => void this.#tools.delete(name),
        get: (name) => this.#tools.get(name),
        list: () => [...this.#tools.values()],
        execute: (name, args, context) => this.executeLocal(name, args, context),
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
    context?: ToolContext
  ): Promise<ToolResult> {
    if (context?.signal?.aborted) {
      return toolError('Execution aborted');
    }
    return this.target().execute(name, args, context);
  }

  private async executeLocal(
    name: string,
    args: Record<string, unknown>,
    context?: ToolContext
  ): Promise<ToolResult> {
    const tool = this.#tools.get(name);
    if (!tool) return toolError(`Unknown tool: ${name}`);

    const elapsed = stopwatch();
    try {
      const result = await tool.execute(args, context);
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
