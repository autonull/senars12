import type { Connection, IOMessage, Logger } from '@senars/core';
import type { AuthManager, CommandRegistry, MessageContext, MessageMiddleware } from '@senars/io';
import type { Agent, BridgeOptions, ConversationSession, SessionManager } from './types.js';
import { createSession } from './session.js';
import type { NAR } from '../nar.js';

function ctxAsRecord(ctx: MessageContext): Record<string, unknown> {
  return ctx as unknown as Record<string, unknown>;
}

function msgAsRecord(msg: IOMessage): Record<string, unknown> {
  return msg as unknown as Record<string, unknown>;
}

function agentAsRecord(agent: Agent): Record<string, unknown> {
  return agent as unknown as Record<string, unknown>;
}

export function createAgentDispatch(agent: Agent): MessageMiddleware {
  return async (msg: IOMessage, ctx: MessageContext, next: () => Promise<void>) => {
    const session = ctxAsRecord(ctx).session as ConversationSession | undefined;
    if (!session) {
      await next();
      return;
    }
    session.history.push({ role: 'user', content: msg.text, timestamp: Date.now() });
    const response = typeof agent.chat === 'function'
      ? await (agent.chat as unknown as (text: string) => Promise<string>)(msg.text)
      : '';
    session.history.push({ role: 'agent', content: response, timestamp: Date.now() });
    const respond = ctxAsRecord(ctx).respond as ((text: string) => Promise<void>) | undefined;
    if (respond) await respond(response);
  };
}

export function bindAgentToConnection(
  agent: Agent,
  conn: Connection,
  opts: BridgeOptions = {}
): () => void {
  const auth = opts.auth;
  const cmdRegistry = opts.commandRegistry;
  const sessionManager: SessionManager = opts.sessionManager ?? new (class implements SessionManager {
    #sessions = new Map<string, ConversationSession>();
    getOrCreate(key: string) {
      let s = this.#sessions.get(key);
      if (!s) { s = createSession(key); this.#sessions.set(key, s); }
      return s;
    }
    size() { return this.#sessions.size; }
  })();

  const handler = async (message: IOMessage) => {
    const sessionKey = resolveSessionKey(message);
    const session = sessionManager.getOrCreate(sessionKey);

    const respond = async (text: string) => {
      try { await conn.send(msgAsRecord(message).source as string ?? 'default', text); } catch { /* ignore */ }
    };

    if (auth) {
      const authResult = auth.checkAuth(conn.id, message.sender ?? message.origin, message.text);
      if (authResult === 'ignore') return;
      if (authResult === 'auth_bound') {
        auth.bindUser(conn.id, message.sender ?? message.origin);
        await respond('Authenticated!');
        return;
      }
    }

    if (message.text.startsWith('/') && cmdRegistry) {
      const parts = message.text.slice(1).split(/\s+/);
      const name = parts[0]!;
      const args = parts.slice(1);
      try {
        const result = await cmdRegistry.execute(name, args, { connection: conn, manager: opts.manager as any });
        if (result === '__CLI_QUIT__') {
          await respond('Goodbye!');
          conn.disconnect?.('user quit');
          return;
        }
        if (result) await respond(result);
      } catch (e: unknown) {
        await respond(`Error: ${(e as Error).message}`);
      }
      return;
    }

    session.history.push({ role: 'user', content: message.text, timestamp: Date.now() });
    const nar = agentAsRecord(agent).getNAR as (() => NAR | undefined) | undefined;
    const response = await (agent.chat as unknown as (text: string) => Promise<string>)(message.text);
    session.history.push({ role: 'agent', content: response, timestamp: Date.now() });
    await respond(response);
  };

  conn.onMessage(handler);
  return () => conn.removeMessageHandler(handler);
}

export function originExtractor(msg: IOMessage, ctx: MessageContext, next: () => Promise<void>): Promise<void> {
  ctxAsRecord(ctx).sessionKey = resolveSessionKey(msg);
  return next();
}

export function resolveSessionKey(msg: IOMessage): string {
  return msg.origin;
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
    const name = parts[0]!;
    const args = parts.slice(1);
    try {
      const result = await registry.execute(name, args, {
        connection: ctxAsRecord(ctx).connection as Connection,
        manager: ctxAsRecord(ctx).manager as any,
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

export function createConnectionConfigsFromEnv(): Array<{ type: string; id: string; [key: string]: unknown }> {
  const configs: Array<{ type: string; id: string; [key: string]: unknown }> = [];

  if (process.env.ENABLE_IRC !== 'false') {
    configs.push({
      type: 'irc',
      id: 'irc-main',
      server: process.env.IRC_SERVER ?? 'irc.libera.chat',
      port: Number(process.env.IRC_PORT) || 6697,
      tls: true,
      nick: process.env.IRC_NICK ?? 'senars-bot',
      channels: (process.env.IRC_CHANNELS ?? '#senars').split(','),
    });
  }

  if (process.env.ENABLE_WS !== 'false') {
    configs.push({
      type: 'websocket',
      id: 'ws-main',
      port: Number(process.env.WS_PORT) || 8765,
    });
  }

  if (process.env.ENABLE_HTTP === 'true') {
    configs.push({
      type: 'http',
      id: 'http-main',
      port: Number(process.env.HTTP_PORT) || 3000,
    });
  }

  if (process.env.ENABLE_MCP === 'true') {
    configs.push({
      type: 'mcp',
      id: 'mcp-main',
      transport: process.env.MCP_TRANSPORT ?? 'stdio',
    });
  }

  return configs;
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

export function agentConfigToOptions(config: Record<string, unknown>): Partial<import('./types.js').AgentOptions> {
  const opts: Partial<import('./types.js').AgentOptions> = {};
  if (typeof config.throttle === 'number') opts.throttle = config.throttle;
  if (typeof config.enableNarseseHumanization === 'boolean') opts.enableNarseseHumanization = config.enableNarseseHumanization;
  if (typeof config.enableNarsTrace === 'boolean') opts.enableNarsTrace = config.enableNarsTrace;
  return opts;
}

export async function registerAllCommands(registry: CommandRegistry): Promise<void> {
  try {
    const io = await import('@senars/io');
    const cmds = [...(io.connectionCommands ?? []), ...(io.authCommands ?? [])];
    for (const cmd of cmds) {
      registry.register(cmd as import('@senars/io').CommandDefinition);
    }
  } catch {
    // commands module not available
  }
}
