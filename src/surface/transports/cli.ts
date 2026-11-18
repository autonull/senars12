/**
 * CLI Transport — CLI transport for surface.
 */

import type { Transport, TransportConfig, TransportMessage } from './types.js';

/** CLI transport config. */
export interface CLITransportConfig extends TransportConfig {
  /** Command to execute. */
  command: string;
  /** Arguments. */
  args: string[];
  /** Environment variables. */
  env?: Record<string, string>;
}

/** Create CLI transport. */
export function createCLITransport(config: CLITransportConfig): Transport {
  return {
    type: 'cli',
    config,
    async send(message: TransportMessage): Promise<TransportMessage> {
      // In real implementation, spawn process and communicate
      return { type: 'response', payload: { result: 'cli response' }, correlationId: message.correlationId, timestamp: Date.now() };
    },
    async close(): Promise<void> {
      // Cleanup
    },
  };
}