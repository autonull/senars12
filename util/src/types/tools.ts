/** Execution guarantees declared by a tool — the single capability contract across core, nar, and io. */
export interface ToolCapabilities {
  pure?: boolean;
  idempotent?: boolean;
  readOnly?: boolean;
  requiresPermissions?: string[];
  timeout?: number;
  maxConcurrency?: number;
}

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly schema: Record<string, unknown>;

  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

import type { ToolResult } from './engine.js';

export type { ToolResult };
