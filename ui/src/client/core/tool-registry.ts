/**
 * Tool registry (§0.5). Client-side tool definitions + approval flow.
 * Tools that require user confirmation register their `approval: true` and
 * the registry opens the `tool-approval` overlay, awaiting user decision.
 *
 * The tool storage now uses `createRegistry` (E2) — the generic registry shape.
 * Execution and approval logic remain tool-specific.
 */

import { createRegistry, type Registry } from './registry.js';
import type { ToolCall } from '@senars/util';
import { eventBus } from './events.js';

/** A JSON-schema-shaped parameter descriptor; nested objects are allowed. */
type ToolParamSchema = {
  type: string;
  title?: string;
  description?: string;
  enum?: string[];
  format?: string;
  items?: unknown;
  properties?: Record<string, ToolParamSchema>;
  additionalProperties?: boolean;
};

export interface ToolSpec {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly parameters: {
    type: 'object';
    properties: Record<string, ToolParamSchema>;
    required?: string[];
  };
  /** Whether this tool requires user approval before execution. */
  readonly approval?: boolean;
  /** Execute the tool (only called after approval if `approval: true`). */
  readonly execute: (args: Record<string, unknown>) => Promise<unknown>;
}

/** The generic tool registry. */
export const toolRegistry: Registry<string, ToolSpec> = createRegistry(
  (spec) => spec.name
);

/**
 * A gated call awaiting the user's decision. The registry owns it (not a view),
 * so a gated tool can never run before the user decides even when the approval
 * overlay has never been mounted.
 */
export interface PendingApproval {
  readonly id: string;
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly spec: ToolSpec;
  readonly resolve: (result: unknown) => void;
  readonly reject: (error: Error) => void;
}

const approvalQueue: PendingApproval[] = [];
let activeApproval: PendingApproval | null = null;
const approvalWatchers = new Set<() => void>();

/** The approval the user must decide on now, or `null`. */
export const currentApproval = (): PendingApproval | null => activeApproval;

/** Observe approval changes; returns the unsubscribe. */
export function onApprovalChange(watcher: () => void): () => void {
  approvalWatchers.add(watcher);
  return () => approvalWatchers.delete(watcher);
}

function notifyApproval(): void {
  for (const watcher of approvalWatchers) watcher();
}

function advanceApproval(): void {
  activeApproval = approvalQueue.shift() ?? null;
  notifyApproval();
}

/** Enqueue a gated call, open the approval overlay, and await the decision. */
function requestApproval(call: ToolCall, spec: ToolSpec): Promise<unknown> {
  return new Promise((resolve, reject) => {
    approvalQueue.push({
      id: call.toolCallId,
      name: call.toolName,
      args: call.args as Record<string, unknown>,
      spec,
      resolve,
      reject,
    });
    if (activeApproval) notifyApproval();
    else advanceApproval();
    eventBus.emit('overlay:open', { id: 'tool-approval' });
  });
}

/** Approve the current call with its (possibly edited) args and advance the queue. */
export function approveCurrent(args: Record<string, unknown>): void {
  const pending = activeApproval;
  if (!pending) return;
  activeApproval = null;
  pending.resolve(args);
  advanceApproval();
}

/** Reject the current call and advance the queue. */
export function rejectCurrent(): void {
  const pending = activeApproval;
  if (!pending) return;
  activeApproval = null;
  pending.reject(new Error('User cancelled'));
  advanceApproval();
}

/** Register a tool. Call during app init. */
export function registerTool(spec: ToolSpec): void {
  toolRegistry.register(spec);
}

/** Get a tool by name. */
export function getTool(name: string): ToolSpec | undefined {
  return toolRegistry.get(name);
}

/** All registered tools. */
export function allTools(): readonly ToolSpec[] {
  return toolRegistry.all();
}

/** Execute a tool call; a gated tool runs only after the user approves it. */
export async function executeToolCall(call: ToolCall): Promise<unknown> {
  const spec = toolRegistry.get(call.toolName);
  if (!spec) throw new Error(`Tool not found: ${call.toolName}`);
  if (!spec.approval) return spec.execute(call.args as Record<string, unknown>);

  const approved = await requestApproval(call, spec);
  return spec.execute(approved as Record<string, unknown>);
}

/** The `prompt_user` tool — system asks user a question/form/confirm/select. */
export const promptUserTool: ToolSpec = {
  name: 'prompt_user',
  title: 'Prompt user',
  description: 'Ask the user a question, confirmation, form, or selection',
  approval: true,
  parameters: {
    type: 'object',
    properties: {
      promptType: {
        type: 'string',
        title: 'Prompt type',
        description: 'Type of prompt to show',
        enum: ['question', 'confirm', 'form', 'select'],
      },
      title: {
        type: 'string',
        title: 'Title',
        description: 'Dialog title',
      },
      message: {
        type: 'string',
        title: 'Message',
        description: 'Prompt message to show the user',
      },
      schema: {
        type: 'object',
        title: 'Form schema',
        description: 'JSON Schema for form fields (when promptType=form)',
        properties: {},
        additionalProperties: true,
      },
      required: {
        type: 'boolean',
        title: 'Required',
        description: 'Whether the user must respond (no cancel)',
      },
      choices: {
        type: 'array',
        title: 'Choices',
        description: 'Options for select prompt',
        items: {
          type: 'object',
          properties: {
            value: { type: 'string', title: 'Value' },
            label: { type: 'string', title: 'Label' },
          },
          required: ['value', 'label'],
        },
      },
    },
    required: ['promptType', 'title', 'message'],
  },
  execute: async (args) => {
    // The approval overlay handles the UI and returns the user's response
    // This execute is called after approval with the user's filled args
    return args;
  },
};

/** Register built-in tools. */
export function registerBuiltinTools(): void {
  registerTool(promptUserTool);
}

/** Helper to emit a tool-call that goes through the approval flow. */
export async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const spec = toolRegistry.get(name);
  if (!spec) throw new Error(`Tool not found: ${name}`);

  const call: ToolCall = {
    toolCallId: `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    toolName: name,
    args,
  };

  return executeToolCall(call);
}
