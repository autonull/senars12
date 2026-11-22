/**
 * IRC Transport — IRC transport for surface.
 */

import type { Transport, TransportConfig, TransportMessage } from './types';

/** IRC transport config. */
export interface IRCTransportConfig extends TransportConfig {
  type: 'irc';
  host: string;
  port: number;
  /** Channels to join. */
  channels: string[];
  /** Nickname. */
  nick: string;
  /** Username. */
  user?: string;
  /** Real name. */
  realName?: string;
  /** Password. */
  password?: string;
  /** TLS. */
  tls?: boolean;
}

/** Create IRC transport. */
export function createIRCTransport(config: IRCTransportConfig): Transport {
  // In a real implementation, use an IRC client library
  // This is a stub implementation
  let connected = false;

  return {
    type: 'irc',
    config,
    async send(message: TransportMessage): Promise<TransportMessage> {
      if (!connected) {
        // Simulate connection
        connected = true;
      }

      // In real implementation, send to IRC channel
      return {
        type: 'response',
        payload: { sent: true, message },
        correlationId: message.correlationId,
        timestamp: Date.now(),
      };
    },
    async close(): Promise<void> {
      connected = false;
      // Disconnect from IRC
    },
  };
}