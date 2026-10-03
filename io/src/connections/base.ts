import { ConnectionError } from '@senars/core';
import { generateId, type Logger, withRetry as retry, Signal, toError } from '@senars/util';
import type {
  Connection,
  ConnectionConfig,
  ConnectionDeps,
  ConnectionState,
  IOMessage,
} from '../types.js';

export abstract class BaseConnection implements Connection {
  id: string;
  name: string;
  abstract readonly type: string;
  protected readonly messageHandlers = new Signal<IOMessage>();
  protected readonly stateChangeHandlers = new Signal<[ConnectionState, ConnectionState]>();
  protected readonly errorHandlers = new Signal<ConnectionError>();
  protected messageCount = 0;
  protected errorCount = 0;
  protected readonly config: ConnectionConfig;
  protected readonly emit: (event: string, data: unknown) => void;
  protected logger!: Logger;
  private queues: Map<string, Promise<unknown>> = new Map();

  protected constructor(config: ConnectionConfig, _deps: ConnectionDeps) {
    this.config = config;
    this.emit = _deps.emit;
    this.id = config.id;
    this.name = (config.config.name as string) ?? 'Connection';
  }

  private _state: ConnectionState = 'disconnected';

  get state(): ConnectionState {
    return this._state;
  }

  abstract connect(): Promise<void>;

  abstract disconnect(reason?: string): Promise<void>;

  abstract send(target: string, text: string): Promise<void>;

  async reconnect(): Promise<void> {
    if (this.state === 'connected') return;
    await this.disconnect('reconnect');
    await this.connect();
  }

  onMessage(handler: (message: IOMessage) => Promise<void>): void {
    this.messageHandlers.on(handler);
  }

  removeMessageHandler(handler: (message: IOMessage) => Promise<void>): void {
    this.messageHandlers.off(handler);
  }

  onStateChange(handler: (state: ConnectionState, prev: ConnectionState) => void): void {
    this.stateChangeHandlers.on(([current, prev]) => handler(current, prev));
  }

  onError(handler: (error: ConnectionError) => void): void {
    this.errorHandlers.on(handler);
  }

  getStatus(): { state: ConnectionState; messageCount: number; errorCount: number } {
    return { state: this.state, messageCount: this.messageCount, errorCount: this.errorCount };
  }

  async reconfigure(config: Record<string, unknown>): Promise<void> {
    Object.assign(this.config.config, config);
  }

  protected createMessage(
    sender: string,
    text: string,
    metadata?: Record<string, unknown>
  ): IOMessage {
    return {
      id: generateId(this.type),
      source: this.id,
      origin: metadata?.origin
        ? String(metadata.origin)
        : `${this.type}:${metadata?.channel ? String(metadata.channel) : 'direct'}:${sender}`,
      sender,
      text,
      timestamp: Date.now(),
      metadata,
    };
  }

  protected isDisconnected(): boolean {
    return this._state === 'disconnected' || this._state === 'idle';
  }

  protected setState(value: ConnectionState): void {
    const prev = this._state;
    if (prev !== value) {
      this._state = value;
      this.emit('connection:state', { id: this.id, prev, current: value });
      this.stateChangeHandlers.emit([value, prev]);
    }
  }

  /** D10: settled rejections must never vanish silently — log + count. */
  protected accountHandlerResults(results: PromiseSettledResult<unknown>[]): void {
    for (const result of results) {
      if (result.status !== 'rejected') continue;
      this.errorCount++;
      this.logger.error(`Message handler error for ${this.id}`, toError(result.reason));
    }
  }

  protected handleMessage(message: IOMessage): void {
    this.messageCount++;
    const origin = message.origin;
    const prev = this.queues.get(origin) ?? Promise.resolve();
    // Message handlers are async and their rejections are counted (D10), so they
    // are driven here rather than through `Signal.emit`, which isolates and drops.
    const handlers = this.messageHandlers.receivers();
    const next = prev.then(async () => {
      this.accountHandlerResults(await Promise.allSettled(handlers.map((h) => h(message))));
    });
    this.queues.set(origin, next);
    next
      .catch((err) => this.logger.error(`Message handler error for ${this.id}`, err as Error))
      .finally(() => {
        if (this.queues.get(origin) === next) this.queues.delete(origin);
      });
  }

  protected handleError(error: ConnectionError): void {
    this.errorCount++;
    this.errorHandlers.emit(error);
  }

  protected createError(
    message: string,
    code: string,
    recoverable: boolean,
    cause?: Error
  ): ConnectionError {
    return new ConnectionError(message, { connectionId: this.id, code, recoverable }, { cause });
  }

  protected withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    return retry(fn, { retries: maxRetries });
  }
}
