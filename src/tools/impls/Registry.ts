import { errMsg, KeyedRegistry, toolError } from '@senars/util';
import { ToolError } from '../../types';
import type {
  Tool,
  ToolCapabilities,
  ToolChainResult,
  ToolChainStep,
  ToolContext,
  ToolFilter,
  ToolRegistry,
  ToolResult,
} from '../types';
import { validateToolArgs } from './validation';

export type { ToolDescriptor } from '@senars/util';

export class Registry extends KeyedRegistry<Tool> implements ToolRegistry {
  constructor() {
    super({
      keyOf: (tool) => tool.name,
      onDuplicate: (name) => {
        throw new ToolError(`Tool '${name}' is already registered`, { tool: name });
      },
    });
  }

  unregister(name: string): void {
    this.delete(name);
  }

  list(_filter?: ToolFilter): Tool[] {
    return this.all();
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context?: ToolContext
  ): Promise<ToolResult> {
    const tool = this.get(name);
    if (!tool) {
      throw new ToolError(`Tool '${name}' not found`, { tool: name });
    }

    try {
      validateToolArgs(tool.parameters, args);
      const result = await tool.execute(args, context);
      return result.partial && result.success && !result.metadata?.hasMore
        ? { ...result, partial: false }
        : result;
    } catch (error) {
      return toolError(errMsg(error));
    }
  }

  async executeChain(chain: ToolChainStep[]): Promise<ToolChainResult> {
    const results: ToolResult[] = [];
    const outputVars: Record<string, unknown> = {};

    for (const step of chain) {
      const args = { ...step.args };

      for (const [key, value] of Object.entries(args)) {
        if (typeof value === 'string' && value.startsWith('$')) {
          const resolved = outputVars[value.slice(1)];
          if (resolved !== undefined) args[key] = resolved;
        }
      }

      const result = await this.execute(step.tool, args);
      results.push(result);

      if (!result.success) {
        return {
          success: false,
          results,
          error: result.error,
        };
      }

      if (step.outputAs) {
        outputVars[step.outputAs] = result.content;
      }
    }

    return {
      success: true,
      results,
      finalContent: results[results.length - 1]?.content,
    };
  }

  getCapabilities(name: string): ToolCapabilities | undefined {
    return this.get(name)?.capabilities;
  }
}
