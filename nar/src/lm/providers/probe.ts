/**
 * Canonical bounded-reachability probes for LM endpoints.
 * Every provider health check funnels through here so timeout policy and
 * fail-closed semantics live in one place.
 */

import { boundedFetch } from '@senars/util';

export interface ProbeOptions {
  readonly timeoutMs?: number;
  readonly headers?: Record<string, string>;
}

const DEFAULT_TIMEOUT_MS = 1500;

/** `GET url` bounded by `timeoutMs`; returns `null` on any transport failure. */
export async function fetchBounded(
  url: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS, headers }: ProbeOptions = {}
): Promise<Response | null> {
  return boundedFetch(url, headers && { headers }, { timeoutMs }).catch(() => null);
}

/** True when the endpoint answers `2xx` within the deadline. */
export const probeReachable = async (url: string, options?: ProbeOptions): Promise<boolean> =>
  (await fetchBounded(url, options))?.ok === true;

/** Parsed JSON body, or `null` when unreachable or malformed. */
export async function probeJson<T>(url: string, options?: ProbeOptions): Promise<T | null> {
  const res = await fetchBounded(url, options);
  if (res?.ok !== true) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Auth headers for a `/models`-style probe: anthropic uses `x-api-key`, others bearer. */
export const probeAuthHeaders = (
  provider: string,
  key: string | undefined
): Record<string, string> | undefined => {
  if (!key) return undefined;
  return provider === 'anthropic'
    ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
    : { Authorization: `Bearer ${key}` };
};

/** Probe an OpenAI-compatible `/models` endpoint; auth sent only when a key is available. */
export const probeModelsEndpoint = async (
  baseUrl: string,
  provider: string,
  key: string | undefined,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<boolean> =>
  probeReachable(`${baseUrl.replace(/\/?$/, '')}/models`, {
    timeoutMs,
    headers: probeAuthHeaders(provider, key),
  });
