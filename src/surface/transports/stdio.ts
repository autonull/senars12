/**
 * Stdio Transport — stdio transport for MCP.
 */

import type { Transport, TransportConfig, TransportMessage } from './types';

/** Stdio transport config. */
export interface StdioTransportConfig extends TransportConfig {
  type: 'stdio';
}

/** Create stdio transport. */
export function createStdioTransport(config: StdioTransportConfig): Transport {
  let buffer = '';
  let closed = false;

  return {
    type: 'stdio',
    config,
    async send(message: TransportMessage): Promise<TransportMessage> {
      // Write to stdout
      process.stdout.write(JSON.stringify(message) + '\n');

      // For request-response, we'd need to read from stdin
      // This is simplified - in real implementation use proper framing
      return {
        type: 'response',
        payload: { sent: true },
        correlationId: message.correlationId,
        timestamp: Date.now(),
      };
    },
    async close(): Promise<void> {
      closed = true;
    },
  };
}

/** Read messages from stdin. */
export function createStdioReader(): AsyncIterable<TransportMessage> {
  const decoder = new TextDecoder();
  let buffer = '';

  return {
    async *[Symbol.asyncIterator](): AsyncIterator<TransportMessage> {
      for await (const chunk of readStdinChunks()) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              yield JSON.parse(line) as TransportMessage;
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    },
  };
}

/** Read stdin chunks. */
async function* readStdinChunks(): AsyncIterable<Uint8Array> {
  for await (const chunk of process.stdin) {
    yield chunk;
  }
}