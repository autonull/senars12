import type { ToolManager } from './manager';
import type { Tool, ToolCapabilities, ToolContext, ToolResult } from './types';

/** core's `ToolSpec` projection: a nar `Tool` plus a positional-correlator signature. */
export interface DelegateToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  capabilities?: ToolCapabilities;
  tags?: string[];
  execute: (
    args: Record<string, unknown>,
    correlationId?: string,
    signal?: AbortSignal
  ) => Promise<ToolResult> | ToolResult;
}

/** core's `SkillFeedback` projection over nar's feedback record. */
export interface DelegateSkillFeedback {
  skill: string;
  lastResult: string;
  successRate: number;
  callCount: number;
  lastError?: string;
}

const toSpec = (tool: Tool): DelegateToolSpec => ({
  name: tool.name,
  description: tool.description,
  parameters: tool.parameters as unknown as Record<string, unknown>,
  capabilities: tool.capabilities,
  tags: tool.tags,
  execute: (args, correlationId, signal) =>
    tool.execute(args, { chainId: correlationId, signal } as ToolContext),
});

const toFeedback = (fb: {
  name: string;
  lastResult?: string;
  successRate: number;
  totalCalls: number;
  lastError?: string;
}): DelegateSkillFeedback => ({
  skill: fb.name,
  lastResult: fb.lastResult ?? '',
  successRate: fb.successRate,
  callCount: fb.totalCalls,
  lastError: fb.lastError,
});

/** Adapter to make nar's ToolManager compatible with core's ToolRegistryDelegate interface. */
export class CoreToolRegistryAdapter {
  constructor(private readonly manager: ToolManager) {}

  register(spec: DelegateToolSpec): void {
    this.manager.register({
      name: spec.name,
      description: spec.description,
      parameters: spec.parameters as unknown as Tool['parameters'],
      capabilities: spec.capabilities,
      tags: spec.tags,
      execute: async (args, context) => spec.execute(args, context?.chainId, context?.signal),
    });
  }

  unregister(name: string): void {
    this.manager.unregister(name);
  }

  get(name: string): DelegateToolSpec | undefined {
    const tool = this.manager.get(name);
    return tool ? toSpec(tool) : undefined;
  }

  list(): DelegateToolSpec[] {
    return this.manager.list().map(toSpec);
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    correlationId?: string,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    return this.manager.execute(name, args, { chainId: correlationId, signal } as ToolContext);
  }

  getFeedback(name: string): DelegateSkillFeedback | undefined {
    const fb = this.manager.getFeedback(name);
    return fb ? toFeedback(fb) : undefined;
  }

  getAllFeedback(): DelegateSkillFeedback[] {
    return this.manager.getAllFeedback().map(toFeedback);
  }

  getRecentResults(limit: number): string {
    return this.manager.getRecentFeedbackString(limit);
  }

  clear(): void {
    for (const tool of this.manager.list()) {
      this.manager.unregister(tool.name);
    }
  }
}
