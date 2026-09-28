import type { AuthManager } from '../auth.js';
import type { CommandRegistry } from '../commands/registry.js';
import { ctxAsRecord, type MessageContext, type MessageMiddleware } from '../router.js';
import { resolveSessionKey } from './ConnectionBinder.js';
import type { Connection, IOMessage, Logger, SessionManager } from '@senars/util';

export function createAuthMiddleware(auth: AuthManager): MessageMiddleware {
  return async (msg: IOMessage, ctx: MessageContext, next: () => Promise<void>) => {
    const conn = ctxAsRecord(ctx).connection as Connection | undefined;
    const connId = conn?.id ?? '';
    const result = auth.checkAuth(connId, msg.sender ?? msg.origin, msg.text);
    if (result === 'allow') {
      await next();
      return;
    }
    if (result === 'auth_bound') {
      auth.bindUser(connId, msg.sender ?? msg.origin);
      const respond = ctxAsRecord(ctx).respond as ((text: string) => Promise<void>) | undefined;
      if (respond) await respond('Authenticated!');
      return;
    }
  };
}

export function createCommandInterceptor(registry: CommandRegistry): MessageMiddleware {
  return async (msg: IOMessage, ctx: MessageContext, next: () => Promise<void>) => {
    if (!msg.text.startsWith('/')) {
      await next();
      return;
    }
    const parts = msg.text.slice(1).split(/\s+/);
    const name = parts.at(0) ?? '';
    const args = parts.slice(1);
    try {
      const result = await registry.execute(name, args, {
        connection: ctxAsRecord(ctx).connection as Connection,
        manager: undefined,
      });
      if (result === '__CLI_QUIT__') {
        const respond = ctxAsRecord(ctx).respond as ((text: string) => Promise<void>) | undefined;
        if (respond) await respond('Goodbye!');
        return;
      }
      const respond = ctxAsRecord(ctx).respond as ((text: string) => Promise<void>) | undefined;
      if (respond && result) await respond(result);
    } catch (e: unknown) {
      const respond = ctxAsRecord(ctx).respond as ((text: string) => Promise<void>) | undefined;
      if (respond) await respond(`Error: ${(e as Error).message}`);
    }
  };
}

export function createSessionBinder(mgr: SessionManager): MessageMiddleware {
  return async (msg: IOMessage, ctx: MessageContext, next: () => Promise<void>) => {
    const key = resolveSessionKey(msg);
    ctxAsRecord(ctx).session = mgr.getOrCreate(key);
    await next();
  };
}

/**
 * Sliding one-second window, at most `maxPerWindow` messages. Timestamps live
 * in a bounded ring indexed by a head cursor: each message advances the cursor
 * and evicts whatever has aged out, so the hot path is O(1) amortized with no
 * per-message filter, realloc, or unbounded growth.
 */
export function createRateLimiter(maxPerWindow: number): MessageMiddleware {
  const capacity = Math.max(1, Math.floor(maxPerWindow));
  const window = new Array<number>(capacity).fill(0);
  let cursor = 0;
  let seen = 0;
  const reject = async (ctx: MessageContext): Promise<void> => {
    const respond = ctxAsRecord(ctx).respond as ((text: string) => Promise<void>) | undefined;
    if (respond) await respond('Rate limit exceeded. Please slow down.');
  };
  return async (_msg: IOMessage, ctx: MessageContext, next: () => Promise<void>) => {
    if (maxPerWindow < 1) return reject(ctx);
    const now = Date.now();
    // `window[cursor]` is the oldest of the last `capacity` arrivals; it is the
    // entry this one displaces, so the window is full exactly when seen==capacity.
    const full = seen >= capacity;
    window[cursor] = now;
    cursor = cursor + 1 === capacity ? 0 : cursor + 1;
    if (seen < capacity) seen++;
    if (full && now - window[cursor]! < 1000) return reject(ctx);
    await next();
  };
}

export function createErrorBoundary(logger: Logger): MessageMiddleware {
  return async (_msg: IOMessage, ctx: MessageContext, next: () => Promise<void>) => {
    try {
      await next();
    } catch (e: unknown) {
      logger.error('middleware pipeline error', e as Error);
      const respond = ctxAsRecord(ctx).respond as ((text: string) => Promise<void>) | undefined;
      if (respond) await respond(`Error: ${(e as Error).message}`);
    }
  };
}
