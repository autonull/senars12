import type { Tool, ToolResult, Schema } from './types';

export class SleepTool implements Tool {
  readonly name = 'sleep';
  readonly description = 'Delay execution for specified milliseconds';
  readonly parameters: Schema = {
    type: 'object',
    properties: {
      duration: { type: 'number', description: 'Duration in milliseconds', minimum: 0, maximum: 60000 }
    },
    required: ['duration']
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { duration } = args as { duration: number };

    try {
      await new Promise(resolve => setTimeout(resolve, duration));
      return {
        success: true,
        content: { slept: duration }
      };
    } catch (error) {
      return {
        success: false,
        content: null,
        error: error instanceof Error ? error.message : 'Sleep failed'
      };
    }
  }
}
