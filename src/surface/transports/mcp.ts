/**
 * MCP Transport — MCP transport for surface.
 */

import type { Transport, TransportConfig, TransportMessage } from './types';
import type { MCPTransportConfig } from '../mcp/types';

/** Create MCP transport. */
export function createMCPTransport(config: MCPTransportConfig): Transport {
  // In a real implementation, this would use the MCP SDK
  // This is a stub that delegates to stdio/http/ws

  return {
    type: 'mcp',
    config,
    async send(message: TransportMessage): Promise<TransportMessage> {
      // Delegate to appropriate sub-transport
      return {
        type: 'response',
        payload: { mcp: true, message },
        correlationId: message.correlationId,
        timestamp: Date.now(),
      };
    },
    async close(): Promise<void> {
      // Close MCP connection
    },
  };
}