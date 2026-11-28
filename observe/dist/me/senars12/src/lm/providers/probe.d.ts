/**
 * Canonical bounded-reachability probes for LM endpoints.
 * Every provider health check funnels through here so timeout policy and
 * fail-closed semantics live in one place.
 */
export interface ProbeOptions {
    readonly timeoutMs?: number;
    readonly headers?: Record<string, string>;
}
/**
 * A base URL and an endpoint path, joined exactly once.
 *
 * Four call sites joined these by hand and disagreed on how: `replace(/\/?$/,
 * '')` twice and `replace(/\/$/, '')` twice, so whether a trailing slash was
 * tolerated depended on which module the caller lived in. A base given as
 * `http://host/v1/` and one given as `http://host/v1` must reach the same URL.
 */
export declare const endpointPath: (base: string, path: string) => string;
/** `GET url` bounded by `timeoutMs`; returns `null` on any transport failure. */
export declare function fetchBounded(url: string, { timeoutMs, headers }?: ProbeOptions): Promise<Response | null>;
/** True when the endpoint answers `2xx` within the deadline. */
export declare const probeReachable: (url: string, options?: ProbeOptions) => Promise<boolean>;
/** Parsed JSON body, or `null` when unreachable or malformed. */
export declare function probeJson<T>(url: string, options?: ProbeOptions): Promise<T | null>;
/** Auth headers for a `/models`-style probe: anthropic uses `x-api-key`, others bearer. */
export declare const probeAuthHeaders: (provider: string, key: string | undefined) => Record<string, string> | undefined;
/** Probe an OpenAI-compatible `/models` endpoint; auth sent only when a key is available. */
export declare const probeModelsEndpoint: (baseUrl: string, provider: string, key: string | undefined, timeoutMs?: number) => Promise<boolean>;
//# sourceMappingURL=probe.d.ts.map