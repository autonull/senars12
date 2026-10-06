import { randomBytes } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { SlidingWindowRateLimiter } from '@senars/util';

export interface HttpGuardOptions {
  apiKey?: string;
  rateLimitPerMinute?: number;
}

/**
 * Guards hand-rolled HTTP servers with API-key auth and a per-key sliding-window
 * rate limit. Health-style paths are exempt. Returns 401/429 when the request is
 * rejected, or null when allowed.
 */
export class HttpGuard {
  private readonly apiKeys = new Set<string>();
  private readonly rateLimiter: SlidingWindowRateLimiter;
  readonly rateLimitPerMinute: number;

  constructor(options: HttpGuardOptions = {}) {
    this.rateLimitPerMinute = options.rateLimitPerMinute ?? 30;
    this.rateLimiter = new SlidingWindowRateLimiter({
      limit: this.rateLimitPerMinute,
      windowMs: 60_000,
    });
    this.apiKeys.add(options.apiKey ?? randomBytes(32).toString('hex'));
  }

  check(req: IncomingMessage, exemptPaths: readonly string[] = []): number | null {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (exemptPaths.includes(url.pathname)) return null;

    const key = (req.headers['x-api-key'] as string | undefined) ?? '';
    if (!key || !this.apiKeys.has(key)) return 401;

    return this.rateLimiter.tryAcquire(key) ? null : 429;
  }

  get activeKey(): string {
    return this.apiKeys.values().next().value ?? '';
  }
}

export const rejectWithStatus = (
  res: { writeHead: (code: number) => { end: (b?: string) => void } },
  status: number
): void => {
  const reason =
    status === 401 ? 'Unauthorized (missing or invalid x-api-key)' : 'Rate limit exceeded';
  res.writeHead(status).end(reason);
};
