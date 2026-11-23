/**
 * HTTP Transport — HTTP transport for surface.
 */

import { TransportBase } from './TransportBase';
import type { HTTPTransportConfig, TransportMessage } from './types';
import { SenarsError } from '../../errors/senars-error';

/** HTTP transport implementation. */
export class HTTPTransport extends TransportBase {
  private messageHandler?: (message: TransportMessage) => void;

  constructor(config: HTTPTransportConfig) {
    super('http', config);
  }

  protected override async doConnect(): Promise<void> {
    // HTTP is stateless, connection is per-request
  }

  protected override async doDisconnect(): Promise<void> {
    // HTTP is stateless, nothing to close
  }

  protected override async doSend(message: TransportMessage): Promise<TransportMessage> {
    const cfg = this.config as HTTPTransportConfig;
    const baseUrl = `http${cfg.tls ? 's' : ''}://${cfg.host}:${cfg.port}${cfg.path ?? ''}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.timeout ?? 30000);

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...cfg.headers,
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new SenarsError(`HTTP ${response.status}: ${response.statusText}`, 'TRANSPORT_ERROR', { status: response.status });
      }

      return await response.json() as TransportMessage;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  protected override onMessageInternal(message: TransportMessage): void {
    this.messageHandler?.(message);
  }

  override onMessage(handler: (message: TransportMessage) => void): () => void {
    this.messageHandler = handler;
    return () => { this.messageHandler = undefined; };
  }
}

/** Create HTTP transport. */
export function createHTTPTransport(config: HTTPTransportConfig): TransportBase {
  return new HTTPTransport(config);
}