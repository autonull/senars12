import type { SkillFeedback, ToolSpec } from '@senars/core/motor';
import { toSkillFeedback } from '@senars/util';
import type { Tool, ToolContext, ToolResult } from '../types';
import type { ToolManager } from './ToolManager';

const toSpec = (tool: Tool): ToolSpec => ({
  name: tool.name,
  description: tool.description,
  parameters: tool.parameters as unknown as Record<string, unknown>,
  capabilities: tool.capabilities,
  tags: tool.tags,
  execute: (args, correlationId, signal) =>
    tool.execute(args, { chainId: correlationId, signal } as ToolContext),
});

/** Adapter to make nar's ToolManager compatible with core's ToolRegistryDelegate interface. */
export class CoreToolRegistryAdapter {
  constructor(private readonly manager: ToolManager) {}

  register(spec: ToolSpec): void {
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

  get(name: string): ToolSpec | undefined {
    const tool = this.manager.get(name);
    return tool ? toSpec(tool) : undefined;
  }

  list(): ToolSpec[] {
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

  getFeedback(name: string): SkillFeedback | undefined {
    const fb = this.manager.getFeedback(name);
    return fb ? toSkillFeedback(fb) : undefined;
  }

  getAllFeedback(): SkillFeedback[] {
    return this.manager.getAllFeedback().map(toSkillFeedback);
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
