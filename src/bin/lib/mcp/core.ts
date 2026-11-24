/**
 * MCP Core — Response Helpers + NAR Tool Bridge
 * Consolidated from mcp-response.ts + mcp-bridge.ts
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import type { NAR } from '../../../agent/index';
import type { Tool, ToolResult, ToolSchema, ToolSchemaProperty } from '../../../agent/index';
import { entryKey, keyedBy } from '@senars/util/collections';
import { type ZodTypeAny, z } from 'zod';

/* ============================================================================
 * Response Helpers (from mcp-response.ts)
 * ==========================================================================*/

export interface MCPStructuredContent<T = unknown> {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: T;
}

/**
 * Creates a standardized MCP tool response with text content and structured content
 */
export function createMCPResponse<T extends Record<string, unknown>>(
  text: string,
  structuredContent: T
): MCPStructuredContent<T> {
  return {
    content: [{ type: 'text', text }],
    structuredContent,
  };
}

/**
 * Formats beliefs array for MCP responses
 */
export function formatBeliefsForMCP(
  beliefs: Array<{ term: { toString(): string }; truth?: unknown }>
): Array<{
  term: string;
  truth: unknown;
}> {
  return beliefs.map((b) => ({
    term: b.term.toString(),
    truth: b.truth,
  }));
}

/**
 * JSON stringifies with pretty printing for MCP text content
 */
export const stringifyMCP = (value: unknown): string => JSON.stringify(value, null, 2);

type UriLike = string | URL;

const uriOf = (uri: UriLike): string => (typeof uri === 'string' ? uri : uri.href);

/** MCP resource result wrapping `payload` as pretty-printed JSON. */
export const jsonContents = <T>(uri: UriLike, payload: T) => ({
  contents: [{ uri: uriOf(uri), mimeType: 'application/json', text: stringifyMCP(payload) }],
});

/** MCP resource result wrapping plain `text`. */
export const textContents = (uri: UriLike, text: string) => ({
  contents: [{ uri: uriOf(uri), mimeType: 'text/plain', text }],
});

/**
 * Registers a JSON-backed MCP resource: the `mimeType`/`contents` envelope is
 * derived, so call sites supply only identity, documentation, and the payload.
 */
export const registerJsonResource = <T>(
  server: McpServer,
  spec: {
    name: string;
    uri: string;
    title: string;
    description: string;
    load: () => T | Promise<T>;
  }
): void => {
  const { name, uri, title, description, load } = spec;
  server.registerResource(
    name,
    uri,
    { title, description, mimeType: 'application/json' },
    async () => jsonContents(uri, await load())
  );
};

/** MCP tool annotation presets — behaviour hints, spelled once. */
export const ANNOTATIONS = {
  /** Pure read: deterministic, no side effects, no open-world data. */
  read: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  /** Idempotent mutation: safe to retry. */
  set: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  /** Additive mutation that is not replay-safe (e.g. admitting a belief twice). */
  apply: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  /** Non-idempotent side effect (consumes budget, runs inference). */
  run: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  /** Talks to the open world (LLM, network) and is not idempotent. */
  open: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
} as const;

/* ============================================================================
 * NAR Tool Bridge (from mcp-bridge.ts)
 * ==========================================================================*/

const zodFromProperty = (p: ToolSchemaProperty): ZodTypeAny => {
  let base: ZodTypeAny;
  switch (p.type) {
    case 'number':
      base = z.number();
      break;
    case 'boolean':
      base = z.boolean();
      break;
    case 'array':
      base = z.array(p.items ? zodFromProperty(p.items) : z.unknown());
      break;
    case 'object': {
      base = z.object(
        keyedBy(Object.entries(p.properties ?? {}), entryKey<string>, ([, prop]) =>
          zodFromProperty(prop)
        )
      );
      break;
    }
    default:
      base = p.enum ? z.enum(p.enum as [string, ...string[]]) : z.string();
  }
  if (p.description) base = base.describe(p.description);
  if (p.minimum !== undefined && base instanceof z.ZodNumber) base = base.min(p.minimum);
  if (p.maximum !== undefined && base instanceof z.ZodNumber) base = base.max(p.maximum);
  return base;
};

export const zodFromSchema = (schema: ToolSchema): Record<string, ZodTypeAny> =>
  keyedBy(Object.entries(schema.properties), entryKey<string>, ([, prop]) => zodFromProperty(prop));

export const toolAnnotations = (tool: Tool) => ({
  readOnlyHint: tool.capabilities?.readOnly ?? false,
  idempotentHint: tool.capabilities?.idempotent ?? false,
  openWorldHint: !tool.capabilities?.pure,
});

const toMcpContent = (result: ToolResult): unknown =>
  result.success ? result.content : { error: result.error ?? 'Tool failed' };

/**
 * Bridge NAR's internal tool registry onto an MCP server.
 * Every registered internal tool becomes an MCP tool with the same ID,
 * so MCP clients and the internal agent share one tool implementation.
 */
export function registerNARRegistryTools(server: McpServer, nar: NAR): void {
  const registered = new Set<string>();
  for (const tool of nar.tools.list()) {
    const name = tool.name;
    if (registered.has(name)) continue;
    registered.add(name);
    server.registerTool(
      name,
      {
        title: tool.name,
        description: tool.description,
        inputSchema: tool.parameters ? zodFromSchema(tool.parameters) : {},
        annotations: toolAnnotations(tool),
      },
      async (args) => {
        const result = await nar.tools.execute(tool.name, args);
        const content = toMcpContent(result) as Record<string, unknown>;
        return createMCPResponse(stringifyMCP(content), content);
      }
    );
  }
}