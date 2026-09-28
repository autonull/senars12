import { searchWeb, type SearchProvider, type WebSearchOutcome } from '@senars/core/motor';
import { tool } from 'ai';
import { z } from 'zod';

// --- web_search ---

export interface WebSearchDeps {
  /** Restrict the failover chain; defaults to the shared provider registry. */
  providers?: readonly SearchProvider[];
  maxResults?: number;
}

/**
 * The AI-SDK face of the shared web-search registry in `@senars/core/motor`.
 * It carries no backend of its own: providers, credentials, timeouts, and the
 * response-size cap all come from the registry, so a tool added here cannot
 * drift from the motor's `search` tool on any of them.
 */
export function createWebSearchTools(deps: WebSearchDeps = {}) {
  const maxResults = deps.maxResults ?? 5;
  return {
    web_search: tool({
      description: 'Search the web for current information. Returns snippets and URLs.',
      inputSchema: z.strictObject({
        query: z.string().describe('The search query'),
        count: z.number().min(1).max(20).optional().default(5).describe('Number of results (1-20)'),
      }),
      execute: async ({ query, count }): Promise<WebSearchOutcome> =>
        searchWeb(query, Math.min(count, maxResults), deps.providers),
    }),
  };
}
