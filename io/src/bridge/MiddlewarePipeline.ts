import {
  type BridgeOptions,
  errMsg,
  type IOMessage,
  type Logger,
  type SessionManager,
} from '@senars/util';
import type { CommandRegistry } from '../commands/registry.js';
import {
  ctxAsRecord,
  type MessageContext,
  type MessageMiddleware,
  resolveSessionKey,
} from '../router.js';

/** The auth contract `BridgeOptions.auth` exposes — any compatible implementation qualifies. */
type BridgeAuth = NonNullable<BridgeOptions['auth']>;

const respondTo = async (ctx: MessageContext, text: string): Promise<void> => {
  const respond = ctxAsRecord(ctx).respond as ((text: string) => Promise<void>) | undefined;
  if (respond) await respond(text);
};

export function createAuthMiddleware(auth: BridgeAuth): MessageMiddleware {
  return async (msg: IOMessage, ctx: MessageContext, next: () => Promise<void>) => {
    const connId = ctx.connection?.id ?? '';
    const result = auth.checkAuth(connId, msg.sender ?? msg.origin, msg.text);
    if (result === 'allow') {
      await next();
      return;
    }
    if (result === 'auth_bound') {
      auth.bindUser(connId, msg.sender ?? msg.origin);
      await respondTo(ctx, 'Authenticated!');
    }
  };
}

export interface CommandInterceptorOptions {
  /** Invoked after acknowledging the `__CLI_QUIT__` sentinel, to tear the connection down. */
  onQuit?: () => void;
}

export function createCommandInterceptor(
  registry: CommandRegistry,
  options: CommandInterceptorOptions = {}
): MessageMiddleware {
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
        connection: ctx.connection,
        manager: ctx.manager,
        nar: ctx.nar,
      });
      if (result === '__CLI_QUIT__') {
        await respondTo(ctx, 'Goodbye!');
        options.onQuit?.();
        return;
      }
      if (result) await respondTo(ctx, result);
    } catch (e: unknown) {
      await respondTo(ctx, `Error: ${errMsg(e)}`);
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
  return async (_msg: IOMessage, ctx: MessageContext, next: () => Promise<void>) => {
    if (maxPerWindow < 1) return respondTo(ctx, 'Rate limit exceeded. Please slow down.');
    const now = Date.now();
    // `window[cursor]` is the oldest of the last `capacity` arrivals; it is the
    // entry this one displaces, so the window is full exactly when seen==capacity.
    const full = seen >= capacity;
    window[cursor] = now;
    cursor = cursor + 1 === capacity ? 0 : cursor + 1;
    if (seen < capacity) seen++;
    if (full && now - window[cursor]! < 1000)
      return respondTo(ctx, 'Rate limit exceeded. Please slow down.');
    await next();
  };
}

export function createErrorBoundary(logger: Logger): MessageMiddleware {
  return async (_msg: IOMessage, ctx: MessageContext, next: () => Promise<void>) => {
    try {
      await next();
    } catch (e: unknown) {
      logger.error('middleware pipeline error', e as Error);
      await respondTo(ctx, `Error: ${errMsg(e)}`);
    }
  };
}
