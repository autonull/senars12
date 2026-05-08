import type { Tool, ToolResult, Schema } from './types';

export class CalculateTool implements Tool {
  readonly name = 'calculate';
  readonly description = 'Mathematical computation tool';
  readonly parameters: Schema = {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'Mathematical expression to evaluate' }
    },
    required: ['expression']
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { expression } = args as { expression: string };

    try {
      const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
      if (sanitized !== expression) {
        return {
          success: false,
          content: null,
          error: 'Invalid characters in expression'
        };
      }

      const result = Function('"use strict";return (' + sanitized + ')')();
      return {
        success: true,
        content: result
      };
    } catch (error) {
      return {
        success: false,
        content: null,
        error: error instanceof Error ? error.message : 'Calculation failed'
      };
    }
  }
}
