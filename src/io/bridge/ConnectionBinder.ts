import type { Agent } from '@senars/core/agent';
import { aggregateChatResponse } from '@senars/core/bridge/chat-stream-handler';
import type { BridgeOptions, Connection, IOMessage } from '@senars/util';
import { InMemorySessionManager } from '@senars/util/memory';
import type { ConnectionManager } from '../connection-manager.js';
import {
  ctxAsRecord,
  type MessageContext,
  type MessageMiddleware,
  MessageRouter,
  resolveSessionKey,
} from '../router.js';
import {
  createAuthMiddleware,
  createCommandInterceptor,
  createSessionBinder,
} from './MiddlewarePipeline.js';

const respondWith =
  (conn: Connection, message: IOMessage) =>
  async (text: string): Promise<void> => {
    try {
      const source = (message as unknown as Record<string, unknown>).source as string;
      await conn.send(source ?? 'default', text);
    } catch {
      /* a failed send must not abort the pipeline */
    }
  };

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
    await ctx.respond(response);
  };
}

/**
 * The single message path: auth, `/`-commands, session binding, and agent
 * dispatch are the shared {@link MiddlewarePipeline} stages, so the connection
 * transport carries no second copy of that logic.
 */
export function bindAgentToConnection(
  agent: Agent,
  conn: Connection,
  opts: BridgeOptions = {}
): () => void {
  const router = new MessageRouter();
  if (opts.auth) router.use(createAuthMiddleware(opts.auth));
  if (opts.commandRegistry)
    router.use(
      createCommandInterceptor(opts.commandRegistry, {
        onQuit: () => conn.disconnect?.('user quit'),
      })
    );
  router.use(createSessionBinder(opts.sessionManager ?? new InMemorySessionManager()));
  router.use(createAgentDispatch(agent));

  const nar = (agent as { getNAR?: () => unknown }).getNAR?.();
  const handler = async (message: IOMessage) => {
    const ctx: MessageContext = {
      connection: conn,
      manager: opts.manager as ConnectionManager | undefined,
      nar,
      respond: respondWith(conn, message),
    };
    await router.route(message, ctx);
  };

  conn.onMessage(handler);
  return () => conn.removeMessageHandler(handler);
}

export { resolveSessionKey };

export function originExtractor(
  msg: IOMessage,
  ctx: MessageContext,
  next: () => Promise<void>
): Promise<void> {
  ctxAsRecord(ctx).sessionKey = resolveSessionKey(msg);
  return next();
}
