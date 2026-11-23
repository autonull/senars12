/**
 * Stdio Transport — stdio transport for MCP.
 */

import { TransportBase } from './TransportBase';
import type { StdioTransportConfig, TransportMessage } from './types';

/** Stdio transport implementation. */
export class StdioTransport extends TransportBase {
  private closed = false;
  private messageHandler?: (message: TransportMessage) => void;

  constructor(config: StdioTransportConfig) {
    super('stdio', config);
    this.setupStdin();
  }

  private setupStdin(): void {
    const decoder = new TextDecoder();
    let buffer = '';

    const handleData = (chunk: Uint8Array): void => {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line) as TransportMessage;
            this.handleReceive(message);
          } catch {
            // Ignore parse errors
          }
        }
      }
    };

    process.stdin.on('data', handleData);
    process.stdin.resume();
  }

  protected override async doConnect(): Promise<void> {
    // Stdio is always connected
  }

  protected override async doDisconnect(): Promise<void> {
    this.closed = true;
    process.stdin.pause();
  }

  protected override async doSend(message: TransportMessage): Promise<TransportMessage> {
    process.stdout.write(JSON.stringify(message) + '\n');

    // For request-response, we'd need to read from stdin
    // This is simplified - in real implementation use proper framing
    return {
      type: 'response',
      payload: { sent: true },
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

/** Create stdio transport. */
export function createStdioTransport(config: StdioTransportConfig): TransportBase {
  return new StdioTransport(config);
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