export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters: Schema;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  list(): Tool[];
  execute(name: string, args: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  content: unknown;
  error?: string;
  partial?: boolean;
}

export interface Schema {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required?: string[];
}

export interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

export interface ToolEvent {
  type: 'tool_call' | 'tool_result';
  name: string;
  args?: Record<string, unknown>;
  result?: ToolResult;
  timestamp: number;
  duration?: number;
}
