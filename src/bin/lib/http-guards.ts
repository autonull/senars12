import { randomBytes } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { ApiKeyManager } from '@senars/io/utils/http';

export interface HttpGuardOptions {
  apiKey?: string;
  rateLimitPerMinute?: number;
}

interface RateLimitState {
  count: number;
  resetTime: number;
}

/**
 * Guards hand-rolled HTTP servers with API-key auth and a per-key sliding-window
 * rate limit. Health-style paths are exempt. Returns 401/429 when the request is
 * rejected, or null when allowed.
 */
export class HttpGuard {
  private readonly apiKeys = new ApiKeyManager();
  private readonly rateLimitState = new Map<string, RateLimitState>();
  readonly rateLimitPerMinute: number;

  constructor(options: HttpGuardOptions = {}) {
    this.rateLimitPerMinute = options.rateLimitPerMinute ?? 30;
    this.apiKeys.add(options.apiKey ?? randomBytes(32).toString('hex'));
  }

  check(req: IncomingMessage, exemptPaths: readonly string[] = []): number | null {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (exemptPaths.includes(url.pathname)) return null;

    const key = (req.headers['x-api-key'] as string | undefined) ?? '';
    if (!key || !this.apiKeys.has(key)) return 401;

    const now = Date.now();
    const state = this.rateLimitState.get(key);
    if (!state || now > state.resetTime) {
      this.rateLimitState.set(key, { count: 1, resetTime: now + 60_000 });
    } else if (state.count >= this.rateLimitPerMinute) {
      return 429;
    } else {
      state.count++;
    }
    return null;
  }

  get activeKey(): string {
    return [...this.apiKeys.keys()][0] ?? '';
  }
}

export const rejectWithStatus = (res: { writeHead: (code: number) => { end: (b?: string) => void } }, status: number): void => {
  const reason = status === 401 ? 'Unauthorized (missing or invalid x-api-key)' : 'Rate limit exceeded';
  res.writeHead(status).end(reason);
};
