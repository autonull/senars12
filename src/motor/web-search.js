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
import { boundedFetch, readBodyBounded } from '@senars/util/async';
import { collectUpTo } from '@senars/util/collections';
import { errMsg } from '@senars/util/error';
import { splitLines } from '@senars/util/text';
import { envFirst } from '@senars/config';
import { WEB_FETCH_TIMEOUT_MS } from '../agent/constants';
import { SenarsError } from '../errors/senars-error';
/** Hard cap on a buffered response body. */
const MAX_BODY_BYTES = 512 * 1024;
/** Cap on the text handed back from a fetched page. */
const MAX_FETCH_CHARS = MAX_BODY_BYTES / 2;
/** This module's request policy over the shared bounded-request primitive. */
const fetchBounded = (url, init) => boundedFetch(url, init, { timeoutMs: WEB_FETCH_TIMEOUT_MS });
const readBody = (res) => readBodyBounded(res, MAX_BODY_BYTES);
const decodeEntities = (s) => s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
const stripTags = (s) => decodeEntities(s.replace(/<[^>]*>/g, '')).trim();
const htmlToText = (html) => html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
/** Collapses the blank lines `htmlToText` leaves behind. */
const collapseBlankLines = (s) => splitLines(s).join('\n');
export const tavilySearch = async (query, apiKey, maxResults = 5) => {
    const res = await fetchBounded('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ query, max_results: maxResults, search_depth: 'basic' }),
    });
    if (!res.ok)
        throw new SenarsError(`tavily ${res.status}`, 'OPERATION_ERROR');
    const data = (await res.json());
    return (data.results ?? [])
        .filter((r) => r.url)
        .map((r) => ({ title: r.title ?? '', url: r.url, snippet: r.content }));
};
export const braveSearch = async (query, apiKey, maxResults = 5) => {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(maxResults));
    const res = await fetchBounded(url.toString(), {
        headers: { accept: 'application/json', 'x-subscription-token': apiKey },
    });
    if (!res.ok)
        throw new SenarsError(`brave ${res.status}`, 'OPERATION_ERROR');
    const data = (await res.json());
    return (data.web?.results ?? [])
        .filter((r) => r.url)
        .map((r) => ({ title: r.title ?? '', url: r.url, snippet: r.description }));
};
const resolveDDGHref = (raw) => {
    const uddg = /uddg=([^&]+)/.exec(raw)?.[1];
    return uddg ? decodeURIComponent(uddg) : raw.startsWith('http') ? raw : undefined;
};
export const duckDuckGoSearch = async (query, maxResults = 5) => {
    const res = await fetchBounded(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers: { 'user-agent': 'Mozilla/5.0 (SeNARS web-fetch; +https://github.com/senars)' } });
    if (!res.ok)
        throw new SenarsError(`duckduckgo ${res.status}`, 'OPERATION_ERROR');
    const html = await readBody(res);
    const linkRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetRe = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    const snippets = [...html.matchAll(snippetRe)].map((m) => stripTags(m[1] ?? ''));
    // Snippets pair with the *admitted* index, not the match index, so the pairing
    // survives a rejected href.
    let admitted = 0;
    return collectUpTo(html.matchAll(linkRe), maxResults, (m) => {
        const [, href, titleHtml] = m;
        if (!href || !titleHtml)
            return undefined;
        const url = resolveDDGHref(decodeEntities(href));
        if (!url)
            return undefined;
        const snippet = snippets[admitted++];
        return { title: stripTags(titleHtml).trim(), url, ...(snippet ? { snippet } : {}) };
    });
};
/**
 * Every backend, in failover order. Keyed providers first (better ranking,
 * real snippets), then the keyless scrape so search works with no credentials.
 * `WEB_SEARCH_API_KEY` is the generic alias and resolves to whichever keyed
 * provider is the only one reading it.
 */
export const SEARCH_PROVIDERS = [
    {
        name: 'tavily',
        configured: () => envFirst('TAVILY_API_KEY') !== undefined,
        search: (query, maxResults) => tavilySearch(query, envFirst('TAVILY_API_KEY'), maxResults),
    },
    {
        name: 'brave',
        configured: () => braveApiKey() !== undefined,
        search: (query, maxResults) => braveSearch(query, braveApiKey(), maxResults),
    },
    { name: 'duckduckgo', configured: () => true, search: duckDuckGoSearch },
];
/** Brave's key, or the generic web-search alias. */
export function braveApiKey() {
    return envFirst('BRAVE_API_KEY') ?? envFirst('WEB_SEARCH_API_KEY');
}
/**
 * Run the provider chain and return the first successful answer. A provider
 * that throws is skipped; when the chain is exhausted the outcome is returned
 * with `via: 'none'` rather than throwing, so a degraded search is a result
 * the caller can reason about instead of an error.
 */
export async function searchWeb(query, maxResults = 5, providers = SEARCH_PROVIDERS) {
    const configured = providers.filter((p) => p.configured());
    if (configured.length === 0)
        return { query, via: 'none', results: [], note: 'no provider configured' };
    const failures = [];
    for (const provider of configured) {
        try {
            return { query, via: provider.name, results: await provider.search(query, maxResults) };
        }
        catch (e) {
            failures.push(`${provider.name}: ${errMsg(e)}`);
        }
    }
    return { query, via: 'none', results: [], note: `all providers failed (${failures.join('; ')})` };
}
export const webFetch = async (url) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new SenarsError(`web-fetch refuses non-http protocol: ${parsed.protocol}`, 'PARSE_ERROR');
    }
    const res = await fetchBounded(parsed, {
        headers: { accept: 'text/html,text/plain,application/json;q=0.9,*/*;q=0.5' },
        redirect: 'follow',
    });
    // `redirect: 'follow'` can land on a scheme the allowlist just rejected, so
    // the *final* URL is re-checked rather than only the requested one.
    const finalUrl = new URL(res.url);
    if (finalUrl.protocol !== 'http:' && finalUrl.protocol !== 'https:') {
        throw new SenarsError(`web-fetch refuses non-http redirect target: ${finalUrl.protocol}`, 'TRANSPORT_ERROR');
    }
    if (!res.ok)
        throw new SenarsError(`web-fetch ${res.status} for ${url}`, 'OPERATION_ERROR');
    const contentType = res.headers.get('content-type') ?? 'text/plain';
    const body = await readBody(res);
    const text = contentType.includes('html')
        ? stripTags(collapseBlankLines(htmlToText(body)))
        : body;
    return { url: res.url, status: res.status, contentType, text: text.slice(0, MAX_FETCH_CHARS) };
};
