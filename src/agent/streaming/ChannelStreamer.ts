import type {StreamChunk} from '../BotContext.js';

/**
 * Channel-specific streaming handler
 * Handles buffering for non-streaming channels (IRC)
 * and direct streaming for WS/HTTP/pipe
 */
export class ChannelStreamer {
  async streamTo(
    connection: {type: string; respond: (text: string | StreamChunk) => Promise<void>},
    stream: AsyncIterable<StreamChunk>
  ): Promise<void> {
    if (connection.type === 'irc') {
      // IRC: buffer all chunks and send as single message
      await this.bufferedStream(connection, stream);
    } else {
      // WS/HTTP/pipe: forward chunks directly
      await this.directStream(connection, stream);
    }
  }

  private async bufferedStream(
    connection: {respond: (text: string | StreamChunk) => Promise<void>},
    stream: AsyncIterable<StreamChunk>
  ): Promise<void> {
    const buffered: string[] = [];

    for await (const chunk of stream) {
      if (chunk.type === 'text' && chunk.content) {
        buffered.push(chunk.content);
      } else if (chunk.type === 'error') {
        buffered.push(`Error: ${chunk.content}`);
      }
    }

    await connection.respond(buffered.join(''));
  }

  private async directStream(
    connection: {respond: (text: string | StreamChunk) => Promise<void>},
    stream: AsyncIterable<StreamChunk>
  ): Promise<void> {
    for await (const chunk of stream) {
      await connection.respond(chunk);
    }
  }
}

export function isStreamChunk(value: unknown): value is StreamChunk {
  if (!value || typeof value !== 'object') return false;
  const chunk = value as Partial<StreamChunk>;
  return (
    chunk.type !== undefined &&
    chunk.content !== undefined &&
    chunk.done !== undefined
  );
}
