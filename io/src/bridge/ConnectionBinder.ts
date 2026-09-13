import type { Agent } from '@senars/core';
import { aggregateChatResponse } from '@senars/core/bridge/chat-stream-handler';
import type { MessageContext, MessageMiddleware } from '@senars/io';
import type { BridgeOptions, Connection, IOMessage } from '@senars/util';
import { InMemorySessionManager } from '@senars/util/memory';

function ctxAsRecord(ctx: MessageContext): Record<string, unknown> {
  return ctx as unknown as Record<string, unknown>;
}

function msgAsRecord(msg: IOMessage): Record<string, unknown> {
  return msg as unknown as Record<string, unknown>;
}

export function createAgentDispatch(agent: Agent): MessageMiddleware {
  return async (msg: IOMessage, ctx: MessageContext, next: () => Promise<void>) => {
    const session = ctxAsRecord(ctx).session as
      | { history: Array<{ role: string; content: string; timestamp: number }> }
      | undefined;
    if (!session) {
      await next();
      return;
    }
    session.history.push({ role: 'user', content: msg.text, timestamp: Date.now() });
    const response = await aggregateChatResponse(agent, msg.text);
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
  const sessionManager = opts.sessionManager ?? new InMemorySessionManager();

  const handler = async (message: IOMessage) => {
    const sessionKey = resolveSessionKey(message);
    const session = sessionManager.getOrCreate(sessionKey);

    const respond = async (text: string) => {
      try {
        await conn.send((msgAsRecord(message).source as string) ?? 'default', text);
      } catch {
        /* ignore */
      }
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
      const name = parts.at(0) ?? '';
      const args = parts.slice(1);
      try {
        const result = await cmdRegistry.execute(name, args, {
          connection: conn,
          manager: undefined,
        });
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
    const response = await aggregateChatResponse(agent, message.text);
    session.history.push({ role: 'agent', content: response, timestamp: Date.now() });
    await respond(response);
  };

  conn.onMessage(handler);
  return () => conn.removeMessageHandler(handler);
}

export function resolveSessionKey(msg: IOMessage): string {
  return msg.origin;
}

export function originExtractor(
  msg: IOMessage,
  ctx: MessageContext,
  next: () => Promise<void>
): Promise<void> {
  ctxAsRecord(ctx).sessionKey = resolveSessionKey(msg);
  return next();
}
