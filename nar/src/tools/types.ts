import type {
  ToolCapabilities,
  ToolContext,
  ToolResult,
  ToolSpec as Tool,
} from '@senars/util';

/**
 * The tool contract is util's — one declaration of identity, argument schema,
 * declared guarantees, and execution. `core`'s registry delegate and this
 * module's registry hand out the same type, so the adapter between them adapts
 * a call rather than re-listing five fields and casting `parameters` twice.
 *
 * `ToolSpec` answers to `Tool` here because that is the name the registry port,
 * the `@tool` decorator, and every tool implementation in this workspace speak.
 */
export type {
  ToolBudget,
  ToolCapabilities,
  ToolContext,
  ToolFn,
  ToolResult,
  ToolSchema,
  ToolSchemaProperty,
  ToolSpec as Tool,
} from '@senars/util';

export interface ToolRegistry {
  register(tool: Tool): void;

  unregister(name: string): void;

  get(name: string): Tool | undefined;

  list(filter?: ToolFilter): Tool[];

  execute(name: string, args: Record<string, unknown>, context?: ToolContext): Promise<ToolResult>;

  executeChain(chain: ToolChainStep[]): Promise<ToolChainResult>;

  getCapabilities(name: string): ToolCapabilities | undefined;
}

export interface ToolFilter {
  tags?: string[];
  permissions?: string[];
  readOnly?: boolean;
}

export interface ToolChainStep {
  tool: string;
  args: Record<string, unknown>;
  outputAs?: string;
}

export interface ToolChainResult {
  success: boolean;
  results: ToolResult[];
  finalContent?: unknown;
  error?: string;
}

export interface ToolEvent {
  type: 'tool_call' | 'tool_result' | 'tool_error';
  name: string;
  args?: Record<string, unknown>;
  result?: ToolResult;
  timestamp: number;
  duration?: number;
  context?: ToolContext;
}

export const createToolEvent = (
  type: ToolEvent['type'],
  name: string,
  startTime: number,
  duration: number,
  extras?: Partial<ToolEvent>
): ToolEvent => ({
  type,
  name,
  timestamp: startTime,
  duration,
  ...extras,
});