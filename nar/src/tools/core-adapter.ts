import type { ToolManager } from './manager';
import type { ToolCapabilities, ToolContext, ToolResult } from './types';

/** Adapter to make nar's ToolManager compatible with core's ToolRegistryDelegate interface. */
export class CoreToolRegistryAdapter {
  constructor(private readonly manager: ToolManager) {}

  register(spec: {
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
  }): void {
    const tool = {
      name: spec.name,
      description: spec.description,
      parameters: spec.parameters as any,
      capabilities: spec.capabilities,
      tags: spec.tags,
      execute: async (args: Record<string, unknown>, context?: ToolContext) =>
        spec.execute(args, context?.chainId as any, context?.signal),
    } as any;
    this.manager.register(tool);
  }

  unregister(name: string): void {
    this.manager.unregister(name);
  }

  get(
    name: string
  ):
    | {
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
    | undefined {
    const tool = this.manager.get(name);
    if (!tool) return undefined;
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as any,
      capabilities: tool.capabilities,
      tags: tool.tags,
      execute: async (
        args: Record<string, unknown>,
        correlationId?: string,
        signal?: AbortSignal
      ) => tool.execute(args, { chainId: correlationId, signal } as any),
    };
  }

  list(): Array<{
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
  }> {
    return this.manager.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as any,
      capabilities: tool.capabilities,
      tags: tool.tags,
      execute: async (
        args: Record<string, unknown>,
        correlationId?: string,
        signal?: AbortSignal
      ) => tool.execute(args, { chainId: correlationId, signal } as any),
    }));
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    correlationId?: string,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    return this.manager.execute(name, args, { chainId: correlationId, signal } as any);
  }

  getFeedback(
    name: string
  ):
    | {
        skill: string;
        lastResult: string;
        successRate: number;
        callCount: number;
        lastError?: string;
      }
    | undefined {
    const fb = this.manager.getFeedback(name);
    if (!fb) return undefined;
    return {
      skill: fb.name,
      lastResult: fb.lastResult ?? '',
      successRate: fb.successRate,
      callCount: fb.totalCalls,
      lastError: fb.lastError,
    };
  }

  getAllFeedback(): Array<{
    skill: string;
    lastResult: string;
    successRate: number;
    callCount: number;
    lastError?: string;
  }> {
    return this.manager.getAllFeedback().map((fb) => ({
      skill: fb.name,
      lastResult: fb.lastResult ?? '',
      successRate: fb.successRate,
      callCount: fb.totalCalls,
      lastError: fb.lastError,
    }));
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
