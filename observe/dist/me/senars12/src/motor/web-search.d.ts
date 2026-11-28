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
export declare const tavilySearch: (query: string, apiKey: string, maxResults?: number) => Promise<WebSearchResult[]>;
export declare const braveSearch: (query: string, apiKey: string, maxResults?: number) => Promise<WebSearchResult[]>;
export declare const duckDuckGoSearch: (query: string, maxResults?: number) => Promise<WebSearchResult[]>;
/**
 * Every backend, in failover order. Keyed providers first (better ranking,
 * real snippets), then the keyless scrape so search works with no credentials.
 * `WEB_SEARCH_API_KEY` is the generic alias and resolves to whichever keyed
 * provider is the only one reading it.
 */
export declare const SEARCH_PROVIDERS: readonly SearchProvider[];
/** Brave's key, or the generic web-search alias. */
export declare function braveApiKey(): string | undefined;
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
export declare function searchWeb(query: string, maxResults?: number, providers?: readonly SearchProvider[]): Promise<WebSearchOutcome>;
export declare const webFetch: (url: string) => Promise<{
    url: string;
    status: number;
    contentType: string;
    text: string;
}>;
//# sourceMappingURL=web-search.d.ts.map