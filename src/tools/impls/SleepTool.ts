import { sleep, toolError, toolOk } from '@senars/util';
import type { ToolSchema, Tool, ToolResult } from '../types';
import { tool } from './decorator.js';

@tool({
  name: 'sleep',
  description: 'Delay execution for specified milliseconds',
  capabilities: { pure: false, readOnly: true },
})
export class SleepTool implements Tool {
  readonly name = 'sleep';
  readonly description = 'Delay execution for specified milliseconds';
  readonly parameters: ToolSchema = {
    type: 'object',
    properties: {
      duration: {
        type: 'number',
        description: 'Duration in milliseconds',
        minimum: 0,
        maximum: 60000,
      },
    },
    required: ['duration'],
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { duration } = args as { duration: number };
    try {
      await sleep(duration);
      return toolOk({ slept: duration });
    } catch (error) {
      return toolError(error);
    }
  }
}
