export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly schema: Record<string, unknown>;

  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

import type { ToolResult } from './engine.js';

export type { ToolResult };
