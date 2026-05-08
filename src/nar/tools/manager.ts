import type { Tool, ToolResult, ToolEvent } from './types';
import { Registry } from './registry';
import { EventEmitter } from 'events';

export class ToolManager extends EventEmitter {
  private registry: Registry = new Registry();
  private executionHistory: ToolEvent[] = [];
  private maxHistory = 100;

  register(tool: Tool): void {
    this.registry.register(tool);
    this.emit('tool:register', { name: tool.name });
  }

  get(name: string): Tool | undefined {
    return this.registry.get(name);
  }

  list(): Tool[] {
    return this.registry.list();
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now();
    const event: ToolEvent = {
      type: 'tool_call',
      name,
      args,
      timestamp: startTime
    };

    this.emit('tool:call', event);
    this.addToHistory(event);

    try {
      const result = await this.registry.execute(name, args);
      
      const resultEvent: ToolEvent = {
        type: 'tool_result',
        name,
        args,
        result,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };

      this.emit('tool:result', resultEvent);
      this.addToHistory(resultEvent);

      return result;
    } catch (error) {
      const errorEvent: ToolEvent = {
        type: 'tool_result',
        name,
        args,
        result: {
          success: false,
          content: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };

      this.emit('tool:error', errorEvent);
      this.addToHistory(errorEvent);

      throw error;
    }
  }

  getHistory(limit = 10): ToolEvent[] {
    return this.executionHistory.slice(-limit);
  }

  clearHistory(): void {
    this.executionHistory = [];
  }

  private addToHistory(event: ToolEvent): void {
    this.executionHistory.push(event);
    if (this.executionHistory.length > this.maxHistory) {
      this.executionHistory.shift();
    }
  }
}
