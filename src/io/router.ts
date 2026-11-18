import { dispatch, type Middleware } from '@senars/util';
import type { ConnectionManager } from './connection-manager.js';
import type { Connection, IOMessage } from './types.js';

export interface MessageContext {
  readonly connection: Connection;
  readonly respond: (text: string) => Promise<void>;
  readonly sessionKey?: string;
  readonly manager?: ConnectionManager;
  /** NAR handle forwarded to the `nar/*` command groups. */
  readonly nar?: unknown;
}

export type MessageMiddleware = (
  message: IOMessage,
  context: MessageContext,
  next: () => Promise<void>
) => Promise<void>;

/** The one dispatch context: the pair every stage receives and the chain threads. */
export interface MessageDispatch {
  readonly message: IOMessage;
  readonly context: MessageContext;
}

/**
 * `MessageContext` is declared `readonly` for consumer safety but is a
 * long-lived per-message scratchpad: middleware attaches `session` and
 * friends to it. Single acknowledged widening point for the bridge.
 */
export const ctxAsRecord = (ctx: MessageContext): Record<string, unknown> =>
  ctx as unknown as Record<string, unknown>;

/** Session identity for a message — the origin channel, the one keying rule. */
export const resolveSessionKey = (msg: IOMessage): string => msg.origin;

export class MessageRouter {
  /**
   * Bound once per `use`, not once per message: the router used to carry its own
   * onion loop, and that loop had none of the guarantees `dispatch` makes — a
   * stage that called `next()` twice silently re-entered the chain instead of
   * failing, and `use` during dispatch could shift the indices under the walk.
   * The loop is `dispatch`; only the three-argument public shape of a stage is
   * ours, so the pair is packed into a context here.
   */
  private readonly chain: Middleware<MessageDispatch>[] = [];

  use(middleware: MessageMiddleware): void {
    this.chain.push((dispatchCtx, next) =>
      middleware(dispatchCtx.message, dispatchCtx.context, next)
    );
  }

  route(message: IOMessage, context: MessageContext): Promise<void> {
    return dispatch(this.chain, { message, context });
  }
}
