/**
 * IRC Transport — IRC transport for surface.
 */

import { TransportBase } from './TransportBase';
import type { IRCTransportConfig, TransportMessage } from './types';

/** IRC transport implementation. */
export class IRCTransport extends TransportBase {
  private connected = false;
  private messageHandler?: (message: TransportMessage) => void;

  constructor(config: IRCTransportConfig) {
    super('irc', config);
  }

  protected override async doConnect(): Promise<void> {
    // In a real implementation, use an IRC client library
    this.connected = true;
  }

  protected override async doDisconnect(): Promise<void> {
    this.connected = false;
    // Disconnect from IRC
  }

  protected override async doSend(message: TransportMessage): Promise<TransportMessage> {
    if (!this.connected) {
      await this.doConnect();
    }

    // In real implementation, send to IRC channel
    return {
      type: 'response',
      payload: { sent: true, message },
      correlationId: message.correlationId,
      timestamp: Date.now(),
    };
  }

  protected override onMessageInternal(message: TransportMessage): void {
    this.messageHandler?.(message);
  }

  override onMessage(handler: (message: TransportMessage) => void): () => void {
    this.messageHandler = handler;
    return () => { this.messageHandler = undefined; };
  }
}

/** Create IRC transport. */
export function createIRCTransport(config: IRCTransportConfig): TransportBase {
  return new IRCTransport(config);
}