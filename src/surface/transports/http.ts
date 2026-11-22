/**
 * HTTP Transport — HTTP transport for surface.
 */

import type { Transport, TransportConfig, TransportMessage } from './types';

/** HTTP transport config. */
export interface HTTPTransportConfig extends TransportConfig {
  type: 'http';
  host: string;
  port: number;
  path?: string;
  /** Request timeout (ms). */
  timeout?: number;
}

/** Create HTTP transport. */
export function createHTTPTransport(config: HTTPTransportConfig): Transport {
  const baseUrl = `http${config.tls ? 's' : ''}://${config.host}:${config.port}${config.path ?? ''}`;

  return {
    type: 'http',
    config,
    async send(message: TransportMessage): Promise<TransportMessage> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeout ?? 30000);

      try {
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...config.headers,
          },
          body: JSON.stringify(message),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json() as TransportMessage;
      } catch (error) {
        clearTimeout(timeout);
        throw error;
      }
    },
    async close(): Promise<void> {
      // HTTP is stateless, nothing to close
    },
  };
}