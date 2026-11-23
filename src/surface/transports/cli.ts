/**
 * CLI Transport — CLI transport for surface.
 */

import { TransportBase } from './TransportBase';
import type { CLITransportConfig, TransportMessage } from './types';

/** CLI transport implementation. */
export class CLITransport extends TransportBase {
  private messageHandler?: (message: TransportMessage) => void;

  constructor(config: CLITransportConfig) {
    super('cli', config);
  }

  protected override async doConnect(): Promise<void> {
    // In real implementation, spawn process and set up communication
  }

  protected override async doDisconnect(): Promise<void> {
    // Cleanup process
  }

  protected override async doSend(message: TransportMessage): Promise<TransportMessage> {
    // In real implementation, spawn process and communicate
    return { type: 'response', payload: { result: 'cli response' }, correlationId: message.correlationId, timestamp: Date.now() };
  }

  protected override onMessageInternal(message: TransportMessage): void {
    this.messageHandler?.(message);
  }

  override onMessage(handler: (message: TransportMessage) => void): () => void {
    this.messageHandler = handler;
    return () => { this.messageHandler = undefined; };
  }
}

/** Create CLI transport. */
export function createCLITransport(config: CLITransportConfig): TransportBase {
  return new CLITransport(config);
}