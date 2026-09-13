export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly schema: Record<string, unknown>;

  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  content: unknown;
  error?: string;
}
