import { tool } from 'ai';
import { z } from 'zod';

// --- web_search ---

export interface WebSearchDeps {
  apiKey?: string;
}

export function createWebSearchTools(deps: WebSearchDeps = {}) {
  const apiKey = deps.apiKey || process.env.BRAVE_API_KEY || process.env.WEB_SEARCH_API_KEY || '';

  return {
    web_search: tool({
      description: 'Search the web for current information. Returns snippets and URLs.',
      inputSchema: z.object({
        query: z.string().describe('The search query'),
        count: z.number().min(1).max(20).optional().default(5).describe('Number of results (1-20)'),
      }),
      execute: async ({ query, count }) => {
        if (!apiKey) {
          return {
            error: 'Web search is not configured. Set BRAVE_API_KEY or WEB_SEARCH_API_KEY.',
            results: [],
          };
        }
        try {
          const url = new URL('https://api.search.brave.com/res/v1/web/search');
          url.searchParams.set('q', query);
          url.searchParams.set('count', String(count));
          const response = await fetch(url.toString(), {
            headers: {
              Accept: 'application/json',
              'X-Subscription-Token': apiKey,
            },
            signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) throw new Error(`Search API error: ${response.status}`);
          const data = (await response.json()) as {
            web?: { results?: Array<{ title: string; url: string; description: string }> };
          };
          const results = (data.web?.results ?? []).map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.description,
          }));
          return { results, count: results.length, query };
        } catch (error) {
          return { error: String(error), results: [], query };
        }
      },
    }),
  };
}
