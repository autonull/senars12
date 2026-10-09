/**
 * Tool registry (§0.5). Client-side tool definitions + approval flow.
 * Tools that require user confirmation register their `approval: true` and
 * the registry opens the `tool-approval` overlay, awaiting user decision.
 */

import type { ToolCall } from '@senars/util';
import { eventBus } from './events.js';

export interface ToolSpec {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      title?: string;
      description?: string;
      enum?: string[];
      format?: string;
      items?: unknown;
    }>;
    required?: string[];
  };
  /** Whether this tool requires user approval before execution. */
  readonly approval?: boolean;
  /** Execute the tool (only called after approval if `approval: true`). */
  readonly execute: (args: Record<string, unknown>) => Promise<unknown>;
}

/** Tools that need approval are handled via the overlay; others execute directly. */
const registry = new Map<string, ToolSpec>();

/** Access the internal tool registry (for debugging/inspection). */
export const toolRegistry = registry;

export let onApprovalRequired: ((call: ToolCall, spec: ToolSpec) => Promise<unknown>) | undefined;

/** Register a tool. Call during app init. */
export function registerTool(spec: ToolSpec): void {
  registry.set(spec.name, spec);
}

/** Get a tool by name. */
export function getTool(name: string): ToolSpec | undefined {
  return registry.get(name);
}

/** All registered tools. */
export function allTools(): ToolSpec[] {
  return [...registry.values()];
}

/** Execute a tool call, handling approval if needed. */
export async function executeToolCall(call: ToolCall): Promise<unknown> {
  const spec = registry.get(call.toolName);
  if (!spec) throw new Error(`Tool not found: ${call.toolName}`);

  if (spec.approval && onApprovalRequired) {
    return onApprovalRequired(call, spec);
  }

  return spec.execute(call.args as Record<string, unknown>);
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
  const spec = registry.get(name);
  if (!spec) throw new Error(`Tool not found: ${name}`);

  const call: ToolCall = {
    toolCallId: `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    toolName: name,
    args,
  };

  return executeToolCall(call);
}

/** Initialize the approval overlay listener. */
export function initToolApproval(): void {
  eventBus.on('tool.approval.request', async ({ call, spec }: { call: ToolCall; spec: ToolSpec }) => {
    if (onApprovalRequired) {
      await onApprovalRequired(call, spec);
    }
  });
}