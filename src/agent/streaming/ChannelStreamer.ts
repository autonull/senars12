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
    await (connection.type === 'irc'
      ? this.bufferedStream(connection, stream)
      : this.directStream(connection, stream));
  }

  private async bufferedStream(
    connection: {respond: (text: string | StreamChunk) => Promise<void>},
    stream: AsyncIterable<StreamChunk>
  ): Promise<void> {
    const buffered: string[] = [];
    for await (const chunk of stream) {
      if (chunk.type === 'text' && chunk?.content) buffered.push(chunk.content);
      else if (chunk.type === 'error') buffered.push(`Error: ${chunk.content}`);
    }
    await connection.respond(buffered.join(''));
  }

  private async directStream(
    connection: {respond: (text: string | StreamChunk) => Promise<void>},
    stream: AsyncIterable<StreamChunk>
  ): Promise<void> {
    for await (const chunk of stream) await connection.respond(chunk);
  }
}

export const isStreamChunk = (value: unknown): value is StreamChunk =>
  !!value && typeof value === 'object' &&
  'type' in value && 'content' in value && 'done' in value;
