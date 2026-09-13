/**
 * Real web tool backends: Tavily search, DuckDuckGo HTML fallback, read-only fetch.
 * All network calls are bounded (timeout + response-size cap) and read-only.
 */

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 512 * 1024;

export interface WebSearchResult {
  title: string;
  url: string;
  snippet?: string;
}

const withTimeout = (): { signal: AbortSignal } | Record<string, never> =>
  typeof AbortSignal.timeout === 'function'
    ? { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
    : {};

const readBody = async (res: Response): Promise<string> => {
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += (value as Uint8Array).byteLength;
    text += decoder.decode(value, { stream: true });
    if (bytes > MAX_BODY_BYTES) {
      void reader.cancel();
      break;
    }
  }
  return text;
};

export const tavilySearch = async (
  query: string,
  apiKey: string,
  maxResults = 5
): Promise<WebSearchResult[]> => {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, max_results: maxResults, search_depth: 'basic' }),
    ...withTimeout(),
  });
  if (!res.ok) throw new Error(`tavily ${res.status}`);
  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (data.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({ title: r.title ?? '', url: r.url as string, snippet: r.content }));
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

export const duckDuckGoSearch = async (
  query: string,
  maxResults = 5
): Promise<WebSearchResult[]> => {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { 'user-agent': 'Mozilla/5.0 (SeNARS web-fetch; +https://github.com/senars12)' },
    ...withTimeout(),
  });
  if (!res.ok) throw new Error(`duckduckgo ${res.status}`);
  const html = await readBody(res);
  const results: WebSearchResult[] = [];
  const linkRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  for (;;) {
    const m = linkRe.exec(html);
    if (!m || results.length >= maxResults) break;
    const href = m[1];
    const titleHtml = m[2];
    if (!href || !titleHtml) continue;
    const url = resolveDDGHref(decodeEntities(href));
    if (!url) continue;
    results.push({ title: stripTags(titleHtml).trim(), url });
  }
  return results;
};

const resolveDDGHref = (raw: string): string | undefined => {
  const m = /uddg=([^&]+)/.exec(raw);
  const uddg = m?.[1];
  return uddg ? decodeURIComponent(uddg) : raw.startsWith('http') ? raw : undefined;
};

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
    ...withTimeout(),
  });
  if (!res.ok) throw new Error(`web-fetch ${res.status} for ${url}`);
  const contentType = res.headers.get('content-type') ?? 'text/plain';
  const body = await readBody(res);
  const text = contentType.includes('html') ? stripTags(extractMainText(htmlToText(body))) : body;
  return { url: res.url, status: res.status, contentType, text: text.slice(0, MAX_BODY_BYTES / 2) };
};

const htmlToText = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');

const extractMainText = (s: string): string =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n');
