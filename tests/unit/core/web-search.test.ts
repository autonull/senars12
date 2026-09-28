import {
  braveApiKey,
  SEARCH_PROVIDERS,
  type SearchProvider,
  searchWeb,
  type WebSearchResult,
} from '@senars/core/motor';
import { createWebSearchTools } from '@senars/nar/tools/adapters/web-search';
import { afterEach, describe, expect, it, vi } from 'vitest';

const results = (n: number): WebSearchResult[] =>
  Array.from({ length: n }, (_, i) => ({ title: `t${i}`, url: `https://e/${i}` }));

const provider = (
  name: string,
  search: (q: string, max: number) => Promise<WebSearchResult[]>,
  configured = true
): SearchProvider => ({ name, configured: () => configured, search });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('search provider registry', () => {
  it('fails over in order and reports which provider answered', async () => {
    const seen: string[] = [];
    const out = await searchWeb('q', 5, [
      provider('a', async () => {
        seen.push('a');
        throw new Error('down');
      }),
      provider('b', async (q, max) => {
        seen.push('b');
        return results(max);
      }),
      provider('c', async () => {
        seen.push('c');
        return results(1);
      }),
    ]);
    expect(seen).toEqual(['a', 'b']);
    expect(out.via).toBe('b');
    expect(out.results).toHaveLength(5);
  });

  it('reports via:none with every failure rather than throwing', async () => {
    const out = await searchWeb('q', 5, [
      provider('a', async () => {
        throw new Error('boom');
      }),
    ]);
    expect(out.via).toBe('none');
    expect(out.results).toEqual([]);
    expect(out.note).toContain('boom');
  });

  it('skips providers that are not configured', async () => {
    const out = await searchWeb('q', 5, [
      provider('a', async () => results(1), false),
      provider('b', async () => results(2)),
    ]);
    expect(out.via).toBe('b');
  });

  it('reports an empty chain instead of throwing', async () => {
    const out = await searchWeb('q', 5, [provider('a', async () => results(1), false)]);
    expect(out.via).toBe('none');
    expect(out.note).toContain('no provider configured');
  });

  it('the default registry is ordered keyed-providers-first with a keyless fallback', () => {
    expect(SEARCH_PROVIDERS.map((p) => p.name)).toEqual(['tavily', 'brave', 'duckduckgo']);
    expect(SEARCH_PROVIDERS.at(-1)?.configured()).toBe(true);
  });

  it('brave reads BRAVE_API_KEY and falls back to the generic alias', () => {
    vi.stubEnv('BRAVE_API_KEY', '');
    vi.stubEnv('WEB_SEARCH_API_KEY', 'generic');
    expect(braveApiKey()).toBe('generic');
    vi.stubEnv('BRAVE_API_KEY', 'specific');
    expect(braveApiKey()).toBe('specific');
  });
});

describe('nar web_search adapter', () => {
  it('delegates to the shared registry and passes the result count through', async () => {
    const calls: Array<[string, number]> = [];
    const tools = createWebSearchTools({
      providers: [
        provider('fake', async (q, max) => {
          calls.push([q, max]);
          return results(max);
        }),
      ],
    });
    const out = await tools.web_search.execute(
      { query: 'kittens', count: 3 },
      { toolCallId: 't', messages: [] } as never
    );
    expect(calls).toEqual([['kittens', 3]]);
    expect(out).toMatchObject({ via: 'fake', query: 'kittens' });
  });

  it('surfaces a failed chain as a result, not a thrown error', async () => {
    const tools = createWebSearchTools({
      providers: [
        provider('fake', async () => {
          throw new Error('offline');
        }),
      ],
    });
    const out = await tools.web_search.execute(
      { query: 'q', count: 2 },
      { toolCallId: 't', messages: [] } as never
    );
    expect(out).toMatchObject({ via: 'none', results: [] });
  });
});
