/**
 * Web search and read-only fetch — one bounded HTTP layer and one provider
 * registry, shared by every surface that offers web access.
 *
 * Every call is bounded twice: a wall-clock timeout and a response-size cap.
 * The cap is enforced while streaming, so an adversarial or simply enormous
 * response cannot be buffered whole before it is truncated.
 *
 * Providers are declarative. Adding one is a `SearchProvider` literal in
 * {@link SEARCH_PROVIDERS}; ordering, configuration detection, and failover
 * are handled here rather than re-implemented per tool.
 */

import { envFirst } from '@senars/util/config';

const FETCH_TIMEOUT_MS = 15_000;
/** Hard cap on a buffered response body. */
const MAX_BODY_BYTES = 512 * 1024;
/** Cap on the text handed back from a fetched page. */
const MAX_FETCH_CHARS = MAX_BODY_BYTES / 2;

export interface WebSearchResult {
  title: string;
  url: string;
  snippet?: string;
}

/** One search backend. `configured` is checked before it enters the chain. */
export interface SearchProvider {
  readonly name: string;
  /** False when the provider's credentials are absent, so it is skipped. */
  configured: () => boolean;
  search: (query: string, maxResults: number) => Promise<WebSearchResult[]>;
}

const bounded = (timeoutMs = FETCH_TIMEOUT_MS): { signal: AbortSignal } => ({
  signal: AbortSignal.timeout(timeoutMs),
});

/**
 * Buffered response text, truncated at {@link MAX_BODY_BYTES}. The cap applies
 * to the no-streaming path too, so it cannot be bypassed by a runtime that
 * does not expose a body reader.
 */
const readBody = async (res: Response): Promise<string> => {
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    return Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES ? text.slice(0, MAX_FETCH_CHARS) : text;
  }
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = value as Uint8Array;
    bytes += chunk.byteLength;
    text += decoder.decode(chunk, { stream: true });
    if (bytes > MAX_BODY_BYTES) {
      void reader.cancel();
      text += '\n[truncated]';
      break;
    }
  }
  return text + decoder.decode();
};

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

const stripTags = (s: string): string => decodeEntities(s.replace(/<[^>]*>/g, '')).trim();

const htmlToText = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');

/** Collapses the blank lines `htmlToText` leaves behind. */
const collapseBlankLines = (s: string): string =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n');



export const tavilySearch = async (
  query: string,
  apiKey: string,
  maxResults = 5
): Promise<WebSearchResult[]> => {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, max_results: maxResults, search_depth: 'basic' }),
    ...bounded(),
  });
  if (!res.ok) throw new Error(`tavily ${res.status}`);
  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (data.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({ title: r.title ?? '', url: r.url as string, snippet: r.content }));
};

export const braveSearch = async (
  query: string,
  apiKey: string,
  maxResults = 5
): Promise<WebSearchResult[]> => {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(maxResults));
  const res = await fetch(url.toString(), {
    headers: { accept: 'application/json', 'x-subscription-token': apiKey },
    ...bounded(),
  });
  if (!res.ok) throw new Error(`brave ${res.status}`);
  const data = (await res.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };
  return (data.web?.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({ title: r.title ?? '', url: r.url as string, snippet: r.description }));
};

const resolveDDGHref = (raw: string): string | undefined => {
  const uddg = /uddg=([^&]+)/.exec(raw)?.[1];
  return uddg ? decodeURIComponent(uddg) : raw.startsWith('http') ? raw : undefined;
};

export const duckDuckGoSearch = async (
  query: string,
  maxResults = 5
): Promise<WebSearchResult[]> => {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { 'user-agent': 'Mozilla/5.0 (SeNARS web-fetch; +https://github.com/senars)' },
    ...bounded(),
  });
  if (!res.ok) throw new Error(`duckduckgo ${res.status}`);
  const html = await readBody(res);
  const results: WebSearchResult[] = [];
  const linkRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  const snippets = [...html.matchAll(snippetRe)].map((m) => stripTags(m[1] ?? ''));
  for (;;) {
    const m = linkRe.exec(html);
    if (!m || results.length >= maxResults) break;
    const [, href, titleHtml] = m;
    if (!href || !titleHtml) continue;
    const url = resolveDDGHref(decodeEntities(href));
    if (!url) continue;
    const snippet = snippets[results.length];
    results.push({ title: stripTags(titleHtml).trim(), url, ...(snippet ? { snippet } : {}) });
  }
  return results;
};

/**
 * Every backend, in failover order. Keyed providers first (better ranking,
 * real snippets), then the keyless scrape so search works with no credentials.
 * `WEB_SEARCH_API_KEY` is the generic alias and resolves to whichever keyed
 * provider is the only one reading it.
 */
export const SEARCH_PROVIDERS: readonly SearchProvider[] = [
  {
    name: 'tavily',
    configured: () => envFirst('TAVILY_API_KEY') !== undefined,
    search: (query, maxResults) => tavilySearch(query, envFirst('TAVILY_API_KEY') as string, maxResults),
  },
  {
    name: 'brave',
    configured: () => braveApiKey() !== undefined,
    search: (query, maxResults) => braveSearch(query, braveApiKey() as string, maxResults),
  },
  { name: 'duckduckgo', configured: () => true, search: duckDuckGoSearch },
];

/** Brave's key, or the generic web-search alias. */
export function braveApiKey(): string | undefined {
  return envFirst('BRAVE_API_KEY') ?? envFirst('WEB_SEARCH_API_KEY');
}

export interface WebSearchOutcome {
  query: string;
  /** Provider that answered, or `none` when every configured provider failed. */
  via: string;
  results: WebSearchResult[];
  note?: string;
}

/**
 * Run the provider chain and return the first successful answer. A provider
 * that throws is skipped; when the chain is exhausted the outcome is returned
 * with `via: 'none'` rather than throwing, so a degraded search is a result
 * the caller can reason about instead of an error.
 */
export async function searchWeb(
  query: string,
  maxResults = 5,
  providers: readonly SearchProvider[] = SEARCH_PROVIDERS
): Promise<WebSearchOutcome> {
  const configured = providers.filter((p) => p.configured());
  if (configured.length === 0) return { query, via: 'none', results: [], note: 'no provider configured' };
  const failures: string[] = [];
  for (const provider of configured) {
    try {
      return { query, via: provider.name, results: await provider.search(query, maxResults) };
    } catch (e) {
      failures.push(`${provider.name}: ${(e as Error).message}`);
    }
  }
  return { query, via: 'none', results: [], note: `all providers failed (${failures.join('; ')})` };
}

export const webFetch = async (
  url: string
): Promise<{ url: string; status: number; contentType: string; text: string }> => {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`web-fetch refuses non-http protocol: ${parsed.protocol}`);
  }
  const res = await fetch(parsed, {
    headers: { accept: 'text/html,text/plain,application/json;q=0.9,*/*;q=0.5' },
    redirect: 'follow',
    ...bounded(),
  });
  // `redirect: 'follow'` can land on a scheme the allowlist just rejected, so
  // the *final* URL is re-checked rather than only the requested one.
  const finalUrl = new URL(res.url);
  if (finalUrl.protocol !== 'http:' && finalUrl.protocol !== 'https:') {
    throw new Error(`web-fetch refuses non-http redirect target: ${finalUrl.protocol}`);
  }
  if (!res.ok) throw new Error(`web-fetch ${res.status} for ${url}`);
  const contentType = res.headers.get('content-type') ?? 'text/plain';
  const body = await readBody(res);
  const text = contentType.includes('html') ? stripTags(collapseBlankLines(htmlToText(body))) : body;
  return { url: res.url, status: res.status, contentType, text: text.slice(0, MAX_FETCH_CHARS) };
};
