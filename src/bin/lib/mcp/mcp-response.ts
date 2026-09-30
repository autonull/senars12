/**
 * MCP Response Helpers
 * Shared JSON serialization for MCP tools and resources
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

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
