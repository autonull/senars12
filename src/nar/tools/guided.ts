import type { ToolManager } from './manager';
import type { Memory } from '../memory';
import { termParser } from '../terms';
import { Truth } from '../terms';
import { createTask, createBudget } from '../types';

export class ToolGuidedReasoning {
  constructor(
    private memory: Memory,
    private toolManager: ToolManager
  ) {
    this.toolManager.on('tool:result', (event) => {
      this.handleToolResult(event);
    });
  }

  private handleToolResult(event: any): void {
    if (event.result?.success) {
      const belief = `(TOOL_RESULT_${event.name} --> ${JSON.stringify(event.result.content)})`;
      try {
        const term = termParser.parse(belief);
        this.memory.addTask(term, 'belief', Truth.NEUTRAL, createBudget(0.5));
      } catch (error) {
        const atomTerm = termParser.parse(`tool_result_${event.name}`);
        this.memory.addTask(atomTerm, 'belief', Truth.NEUTRAL, createBudget(0.5));
      }
    }
  }

  async executeToolAndReason(toolName: string, args: Record<string, unknown>): Promise<boolean> {
    try {
      const result = await this.toolManager.execute(toolName, args);
      return result.success;
    } catch (error) {
      return false;
    }
  }
}
