/**
 * MCP Transport — MCP transport for surface.
 */

import { TransportBase } from './TransportBase';
import type { TransportMessage } from './types';
import type { MCPTransportConfig } from '../mcp/types';

/** MCP transport implementation. */
export class MCPTransport extends TransportBase {
  private messageHandler?: (message: TransportMessage) => void;

  constructor(config: MCPTransportConfig) {
    super('mcp', config);
  }

  protected override async doConnect(): Promise<void> {
    // In a real implementation, this would use the MCP SDK
    // This is a stub that delegates to stdio/http/ws
  }

  protected override async doDisconnect(): Promise<void> {
    // Close MCP connection
  }

  protected override async doSend(message: TransportMessage): Promise<TransportMessage> {
    // Delegate to appropriate sub-transport
    return {
      type: 'response',
      payload: { mcp: true, message },
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

/** Create MCP transport. */
export function createMCPTransport(config: MCPTransportConfig): TransportBase {
  return new MCPTransport(config);
}