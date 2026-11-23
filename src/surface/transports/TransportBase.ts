/**
 * Transport Base — unified transport abstraction with middleware chain.
 *
 * All surface transports (stdio, ws, http, mcp, cli, irc) extend this base
 * to inherit lifecycle, heartbeat, reconnection, session mgmt, and MIDDLEWARE CHAIN.
 */

import type { Transport, TransportConfig, TransportMessage, TransportType } from './types';

/** Middleware context for connect phase. */
export interface ConnectContext {
  readonly config: TransportConfig;
  readonly transport: Transport;
}

/** Middleware context for disconnect phase. */
export interface DisconnectContext {
  readonly config: TransportConfig;
  readonly transport: Transport;
  readonly reason?: string;
}

/** Transport middleware interface. */
export interface TransportMiddleware {
  /** Called before connection is established. */
  onConnect?(ctx: ConnectContext): Promise<void>;

  /** Called after connection is closed. */
  onDisconnect?(ctx: DisconnectContext): Promise<void>;

  /** Called before sending a message. `next` continues the chain. */
  onSend?(message: TransportMessage, next: () => Promise<void>): Promise<void>;

  /** Called when a message is received. `next` passes message to next middleware. */
  onReceive?(message: TransportMessage, next: (msg: TransportMessage) => void): void;
}

/** Abstract base class for all transports. */
export abstract class TransportBase implements Transport {
  readonly type: TransportType;
  readonly config: TransportConfig;
  readonly #middleware: TransportMiddleware[] = [];

  protected constructor(type: TransportType, config: TransportConfig) {
    this.type = type;
    this.config = config;
  }

  /** Add middleware to the chain. */
  use(middleware: TransportMiddleware): this {
    this.#middleware.push(middleware);
    return this;
  }

  /** Get all registered middleware. */
  getMiddleware(): readonly TransportMiddleware[] {
    return this.#middleware;
  }

  /** Connect with middleware chain. */
  async connect(): Promise<void> {
    const ctx: ConnectContext = { config: this.config, transport: this };
    for (const mw of this.#middleware) {
      if (mw.onConnect) await mw.onConnect(ctx);
    }
    await this.doConnect();
  }

  /** Disconnect with middleware chain. */
  async disconnect(reason?: string): Promise<void> {
    await this.doDisconnect();
    const ctx: DisconnectContext = { config: this.config, transport: this, reason };
    for (const mw of this.#middleware) {
      if (mw.onDisconnect) await mw.onDisconnect(ctx);
    }
  }

  /** Send message with middleware chain. */
  async send(message: TransportMessage): Promise<TransportMessage> {
    let result: TransportMessage | undefined;

    const doSend = async (): Promise<void> => {
      result = await this.doSend(message);
    };

    // Build middleware chain in reverse order (last middleware wraps first)
    let chain: () => Promise<void> = doSend;
    const middleware = this.#middleware;
    for (let i = middleware.length - 1; i >= 0; i--) {
      const mw = middleware[i]!;
      if (mw.onSend) {
        const next = chain;
        chain = async () => mw.onSend!(message, next);
      }
    }

    await chain();
    return result!;
  }

  /** Handle received message with middleware chain. */
  protected handleReceive(message: TransportMessage): void {
    let idx = 0;
    const middleware = this.#middleware;
    const next = (msg: TransportMessage): void => {
      if (idx < middleware.length) {
        const mw = middleware[idx++]!;
        if (mw.onReceive) {
          mw.onReceive(msg, next);
        } else {
          next(msg);
        }
      } else {
        this.onMessageInternal(msg);
      }
    };
    next(message);
  }

  /** Internal message handler — override in subclasses. */
  protected onMessageInternal(_message: TransportMessage): void {
    // Default: no-op
  }

  /** Register a message handler. */
  onMessage(handler: (message: TransportMessage) => void): () => void {
    // Subclasses should implement this to register their own handlers
    // This base implementation is a no-op
    return () => {};
  }

  /** Abstract: establish connection. */
  protected abstract doConnect(): Promise<void>;

  /** Abstract: close connection. */
  protected abstract doDisconnect(): Promise<void>;

  /** Abstract: send message. */
  protected abstract doSend(message: TransportMessage): Promise<TransportMessage>;

  /** Close transport (alias for disconnect). */
  async close(): Promise<void> {
    await this.disconnect();
  }
}