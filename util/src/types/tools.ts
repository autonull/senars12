import type { ToolResult } from './engine.js';

export type { ToolResult };

/** Execution guarantees declared by a tool — the single capability contract across core, nar, and io. */
export interface ToolCapabilities {
  pure?: boolean;
  idempotent?: boolean;
  readOnly?: boolean;
  requiresPermissions?: string[];
  timeout?: number;
  maxConcurrency?: number;
}

/** JSON Schema for a tool's arguments. The one schema shape core's registry and nar's registry share. */
export interface ToolSchema {
  type: 'object';
  properties: Record<string, ToolSchemaProperty>;
  required?: string[];
}

export interface ToolSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  items?: ToolSchemaProperty;
  properties?: Record<string, ToolSchemaProperty>;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: unknown[];
  /** JSON Schema `default`, reported to a caller that omits the property. */
  default?: unknown;
}

/** The ceiling a caller puts on one invocation; the runner charges it in place. */
export interface ToolBudget {
  maxExecutions?: number;
  maxTotalDuration?: number;
  executions?: number;
  totalDuration?: number;
}

/**
 * What one invocation is handed: the id of the utterance or cycle that caused
 * it, its cancellation, and what it may charge. A context nests when a tool calls
 * another, so the parent carries the outer ceiling.
 */
export interface ToolContext {
  chainId?: string;
  signal?: AbortSignal;
  permissions?: Set<string>;
  budget?: ToolBudget;
  parent?: ToolContext;
}

export type ToolFn = (
  args: Record<string, unknown>,
  context?: ToolContext
) => Promise<ToolResult> | ToolResult;

/**
 * The one tool contract: identity, argument schema, declared guarantees, execution.
 * `core`'s registry delegate and `nar`'s registry both hand out this type, so the
 * adapter between them adapts a *call* — provenance and cancellation travel in the
 * context — rather than re-listing the five fields a record happens to share.
 */
export interface ToolSpec {
  readonly name: string;
  readonly description: string;
  readonly parameters: ToolSchema;
  readonly capabilities?: ToolCapabilities;
  readonly tags?: string[];
  execute(args: Record<string, unknown>, context?: ToolContext): Promise<ToolResult> | ToolResult;
}

/**
 * One requested invocation: which tool, which turn asked for it, and with what.
 *
 * The model runner and `core`'s dispatcher each declared it — the same three
 * fields under two names — so the record that crosses the model boundary had two
 * shapes and the dispatcher had to be handed one of them. It belongs beside
 * {@link ToolSpec} because a call is only meaningful against a spec.
 */
export interface ToolCall {
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
}

/** What a registry reports about a tool without handing back its body. */
export type ToolDescriptor = Pick<ToolSpec, 'name' | 'description' | 'capabilities' | 'tags'> & {
  version?: string;
};
