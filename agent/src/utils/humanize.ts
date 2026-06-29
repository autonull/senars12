/**
 * Tool Humanization Utilities
 * Extracted from io-middleware for reusability
 */

import type { ChatStreamEvent } from '../types.js';

/**
 * Humanize tool call events for user-friendly display
 */
export function humanizeToolCall(name: string, args?: Record<string, unknown>): string | undefined {
  if (!args) return undefined;
  if (name === 'nar_believe' && typeof args.statement === 'string') {
    return `_(storing: ${args.statement})_\n`;
  }
  if (name === 'nar_query' && typeof args.term === 'string') {
    return `_(querying: ${args.term})_\n`;
  }
  if (name === 'calculate' && typeof args.expression === 'string') {
    return `_(calculating: ${args.expression})_\n`;
  }
  if (name === 'know' && typeof args.key === 'string') {
    return `_(remembering: ${args.key})_\n`;
  }
  return undefined;
}

/**
 * Humanize tool result events for user-friendly display
 */
export function humanizeToolResult(
  name: string,
  args?: Record<string, unknown>,
  result?: unknown
): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const r = result as Record<string, unknown>;
  if (name === 'calculate' && 'result' in r && typeof r.result === 'number') {
    return `_\`${args?.expression ?? '?'}\` = ${r.result}_\n`;
  }
  if (name === 'nar_believe' && r.success && typeof args?.statement === 'string') {
    return `_\u2713 stored: ${args.statement}_\n`;
  }
  if (name === 'know' && r.stored === true && typeof args?.key === 'string') {
    return `_\u2713 stored: ${args.key}_\n`;
  }
  return undefined;
}

/**
 * Process streaming events with optional humanization
 */
export interface StreamingProcessorOptions {
  humanizeTools?: boolean;
  onTextDelta?: (text: string) => Promise<void>;
  onToolCall?: (name: string, args: Record<string, unknown>) => Promise<void>;
  onToolResult?: (name: string, args: Record<string, unknown>, result: unknown) => Promise<void>;
  onError?: (error: string) => Promise<void>;
  onAborted?: () => Promise<void>;
}

export async function processStreamingEvents(
  iter: AsyncGenerator<ChatStreamEvent, string>,
  opts: StreamingProcessorOptions = {}
): Promise<string> {
  const { humanizeTools = true } = opts;
  let finalText = '';
  let streamedText = '';

  let nextEvent = await iter.next();
  while (!nextEvent.done) {
    const ev = nextEvent.value;

    if (ev.kind === 'text-delta' && ev.text) {
      streamedText += ev.text;
      finalText = streamedText;
      if (opts.onTextDelta) {
        await opts.onTextDelta(ev.text);
      }
    } else if (ev.kind === 'tool-call' && humanizeTools && ev.toolName) {
      const note = humanizeToolCall(ev.toolName, ev.toolArgs);
      if (note && opts.onTextDelta) {
        await opts.onTextDelta(note);
      }
      if (opts.onToolCall) {
        await opts.onToolCall(ev.toolName, ev.toolArgs ?? {});
      }
    } else if (ev.kind === 'tool-result' && humanizeTools && ev.toolName) {
      const note = humanizeToolResult(ev.toolName, ev.toolArgs ?? {}, ev.toolResult);
      if (note && opts.onTextDelta) {
        await opts.onTextDelta(note);
      }
      if (opts.onToolResult) {
        await opts.onToolResult(ev.toolName, ev.toolArgs ?? {}, ev.toolResult);
      }
    } else if (ev.kind === 'error') {
      if (opts.onError && ev.error) {
        await opts.onError(ev.error);
      }
    } else if (ev.kind === 'aborted') {
      if (opts.onAborted) {
        await opts.onAborted();
      }
    }

    nextEvent = await iter.next();
  }

  finalText = nextEvent.value || streamedText;

  return finalText;
}

export const NARSESE_OUTPUT_RE = /[(<{}\[].*?[)>}\]]/;
