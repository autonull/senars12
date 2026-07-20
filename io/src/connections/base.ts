import { ConnectionError } from '@senars/core';
import type {
  Connection,
  ConnectionConfig,
  ConnectionDeps,
  ConnectionState,
  IOMessage,
  Logger,
} from '../types.js';

export abstract class BaseConnection implements Connection {
  id: string;
  name: string;
  abstract readonly type: string;
  protected messageHandlers: Array<(message: IOMessage) => Promise<void>> = [];
  protected stateChangeHandlers: Array<(state: ConnectionState, prev: ConnectionState) => void> =
    [];
  protected errorHandlers: Array<(error: ConnectionError) => void> = [];
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
    this.messageHandlers.push(handler);
  }

  removeMessageHandler(handler: (message: IOMessage) => Promise<void>): void {
    this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
  }

  onStateChange(handler: (state: ConnectionState, prev: ConnectionState) => void): void {
    this.stateChangeHandlers.push(handler);
  }

  onError(handler: (error: ConnectionError) => void): void {
    this.errorHandlers.push(handler);
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
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
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
      this.stateChangeHandlers.forEach((h) => h(value, prev));
    }
  }

  protected handleMessage(message: IOMessage): void {
    this.messageCount++;
    const origin = message.origin;
    const prev = this.queues.get(origin) ?? Promise.resolve();
    const handlers = this.messageHandlers.slice();
    const next = prev.then(() => Promise.allSettled(handlers.map((h) => h(message))));
    this.queues.set(origin, next);
    next
      .catch((err) => this.logger.error(`Message handler error for ${this.id}`, err as Error))
      .finally(() => {
        if (this.queues.get(origin) === next) this.queues.delete(origin);
      });
  }

  protected handleError(error: ConnectionError): void {
    this.errorCount++;
    this.errorHandlers.forEach((h) => h(error));
  }

  protected createError(
    message: string,
    code: string,
    recoverable: boolean,
    cause?: Error
  ): ConnectionError {
    return new ConnectionError(message, this.id, code, recoverable, cause);
  }

  protected withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    return this._withRetry(fn, maxRetries, 0);
  }

  private async _withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    attempt: number
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= maxRetries) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(100 * Math.pow(2, attempt), 1000))
      );
      return this._withRetry(fn, maxRetries, attempt + 1);
    }
  }
}
