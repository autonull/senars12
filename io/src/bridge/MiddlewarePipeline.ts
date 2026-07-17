import type { AuthManager, CommandRegistry, MessageContext, MessageMiddleware } from '@senars/io';
import type { Connection, IOMessage, Logger, SessionManager } from '@senars/util';

function ctxAsRecord(ctx: MessageContext): Record<string, unknown> {
  return ctx as unknown as Record<string, unknown>;
}

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
    const resolveSessionKey = (m: IOMessage): string => m.origin;
    const key = resolveSessionKey(msg);
    ctxAsRecord(ctx).session = mgr.getOrCreate(key);
    await next();
  };
}

export function createRateLimiter(maxPerWindow: number): MessageMiddleware {
  const timestamps: number[] = [];
  return async (msg: IOMessage, ctx: MessageContext, next: () => Promise<void>) => {
    const now = Date.now();
    const window = timestamps.filter((t) => now - t < 1000);
    timestamps.length = 0;
    timestamps.push(...window, now);
    if (timestamps.length > maxPerWindow) {
      const respond = ctxAsRecord(ctx).respond as ((text: string) => Promise<void>) | undefined;
      if (respond) await respond('Rate limit exceeded. Please slow down.');
      return;
    }
    await next();
  };
}

export function createErrorBoundary(logger: Logger): MessageMiddleware {
  return async (msg: IOMessage, ctx: MessageContext, next: () => Promise<void>) => {
    try {
      await next();
    } catch (e: unknown) {
      logger.error('middleware pipeline error', e as Error);
      const respond = ctxAsRecord(ctx).respond as ((text: string) => Promise<void>) | undefined;
      if (respond) await respond(`Error: ${(e as Error).message}`);
    }
  };
}
