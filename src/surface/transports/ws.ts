/**
 * WebSocket Transport — WebSocket transport for surface.
 */

import { TransportBase } from './TransportBase';
import type { WSTransportConfig, TransportMessage } from './types';
import { SenarsError } from '../../errors/senars-error';


/** WebSocket transport state. */
interface WSState {
  ws: WebSocket | null;
  pending: Map<string, { resolve: (value: TransportMessage) => void; reject: (error: Error) => void }>;
  reconnectAttempts: number;
  closed: boolean;
}

/** WebSocket transport implementation. */
export class WSTransport extends TransportBase {
  private state: WSState;
  private messageHandler?: (message: TransportMessage) => void;

  constructor(config: WSTransportConfig) {
    super('ws', config);
    this.state = {
      ws: null,
      pending: new Map(),
      reconnectAttempts: 0,
      closed: false,
    };
  }

  protected override async doConnect(): Promise<void> {
    const cfg = this.config as WSTransportConfig;
    const url = `ws${cfg.tls ? 's' : ''}://${cfg.host}:${cfg.port}${cfg.path ?? ''}`;
    
    await new Promise<void>((resolve, reject) => {
      this.state.ws = new WebSocket(url);

      this.state.ws.onopen = () => {
        this.state.reconnectAttempts = 0;
        resolve();
      };

      this.state.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as TransportMessage;
          this.handleReceive(message);
        } catch {
          // Ignore parse errors
        }
      };

      this.state.ws.onerror = (error) => {
        reject(new SenarsError(`WebSocket error: ${error}`, 'TRANSPORT_ERROR'));
      };

      this.state.ws.onclose = () => {
        if (!this.state.closed && this.state.reconnectAttempts < (cfg.maxReconnectAttempts ?? 5)) {
          this.state.reconnectAttempts++;
          setTimeout(() => this.doConnect().catch(() => {}), cfg.reconnectInterval ?? 1000);
        }
      };
    });
  }

  protected override async doDisconnect(): Promise<void> {
    this.state.closed = true;
    if (this.state.ws) {
      this.state.ws.close();
      this.state.ws = null;
    }
  }

  protected override async doSend(message: TransportMessage): Promise<TransportMessage> {
    if (!this.state.ws || this.state.ws.readyState !== WebSocket.OPEN) {
      await this.doConnect();
    }

    return new Promise((resolve, reject) => {
      if (!this.state.ws) {
        reject(new SenarsError('WebSocket not connected', 'TRANSPORT_ERROR'));
        return;
      }

      const correlationId = message.correlationId ?? `msg-${Date.now()}`;
      const msgWithId = { ...message, correlationId };

      this.state.pending.set(correlationId, { resolve, reject });

      this.state.ws!.send(JSON.stringify(msgWithId));

      // Timeout
      setTimeout(() => {
        if (this.state.pending.has(correlationId)) {
          this.state.pending.delete(correlationId);
          reject(new SenarsError('Request timeout', 'TIMEOUT'));
        }
      }, 30000);
    });
  }

  protected override onMessageInternal(message: TransportMessage): void {
    const pending = this.state.pending.get(message.correlationId ?? '');
    if (pending) {
      this.state.pending.delete(message.correlationId ?? '');
      if (message.type === 'error') {
        pending.reject(new SenarsError(message.payload as string, 'OPERATION_ERROR'));
      } else {
        pending.resolve(message);
      }
    }
    this.messageHandler?.(message);
  }

  override onMessage(handler: (message: TransportMessage) => void): () => void {
    this.messageHandler = handler;
    return () => { this.messageHandler = undefined; };
  }
}

/** Create WebSocket transport. */
export function createWSTransport(config: WSTransportConfig): TransportBase {
  return new WSTransport(config);
}