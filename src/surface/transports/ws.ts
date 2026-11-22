/**
 * WebSocket Transport — WebSocket transport for surface.
 */

import type { Transport, TransportConfig, TransportMessage } from './types';

/** WebSocket transport config. */
export interface WSTransportConfig extends TransportConfig {
  type: 'ws';
  host: string;
  port: number;
  path?: string;
  /** Reconnect interval (ms). */
  reconnectInterval?: number;
  /** Max reconnect attempts. */
  maxReconnectAttempts?: number;
}

/** WebSocket transport state. */
interface WSState {
  ws: WebSocket | null;
  pending: Map<string, { resolve: (value: TransportMessage) => void; reject: (error: Error) => void }>;
  reconnectAttempts: number;
  closed: boolean;
}

/** Create WebSocket transport. */
export function createWSTransport(config: WSTransportConfig): Transport {
  const state: WSState = {
    ws: null,
    pending: new Map(),
    reconnectAttempts: 0,
    closed: false,
  };

  const url = `ws${config.tls ? 's' : ''}://${config.host}:${config.port}${config.path ?? ''}`;

  const connect = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      state.ws = new WebSocket(url);

      state.ws.onopen = () => {
        state.reconnectAttempts = 0;
        resolve();
      };

      state.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as TransportMessage;
          const pending = state.pending.get(message.correlationId ?? '');
          if (pending) {
            state.pending.delete(message.correlationId ?? '');
            if (message.type === 'error') {
              pending.reject(new Error(message.payload as string));
            } else {
              pending.resolve(message);
            }
          }
        } catch {
          // Ignore parse errors
        }
      };

      state.ws.onerror = (error) => {
        reject(new Error(`WebSocket error: ${error}`));
      };

      state.ws.onclose = () => {
        if (!state.closed && state.reconnectAttempts < (config.maxReconnectAttempts ?? 5)) {
          state.reconnectAttempts++;
          setTimeout(connect, config.reconnectInterval ?? 1000);
        }
      };
    });
  };

  // Initial connection
  connect().catch(() => {});

  return {
    type: 'ws',
    config,
    async send(message: TransportMessage): Promise<TransportMessage> {
      if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
        await connect();
      }

      return new Promise((resolve, reject) => {
        if (!state.ws) {
          reject(new Error('WebSocket not connected'));
          return;
        }

        const correlationId = message.correlationId ?? `msg-${Date.now()}`;
        const msgWithId = { ...message, correlationId };

        state.pending.set(correlationId, { resolve, reject });

        state.ws.send(JSON.stringify(msgWithId));

        // Timeout
        setTimeout(() => {
          if (state.pending.has(correlationId)) {
            state.pending.delete(correlationId);
            reject(new Error('Request timeout'));
          }
        }, 30000);
      });
    },
    async close(): Promise<void> {
      state.closed = true;
      if (state.ws) {
        state.ws.close();
        state.ws = null;
      }
    },
  };
}