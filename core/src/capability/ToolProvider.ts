import type { ToolDefinition } from '../backend/Backend.js';

export interface ToolResult {
  success: boolean;
  content: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolProvider {
  getTools(): ToolDefinition[];
  executeTool(name: string, args: Record<string, unknown>, correlationId?: string): Promise<ToolResult>;
}
