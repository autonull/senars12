import type {Message, StreamChunk} from '../BotContext.js';

/**
 * LMClient extension for streaming support as specified in BOT4.md
 */
export interface LMStreamingClient {
  isAvailable(): boolean;
  supportsStreaming(): boolean;
  generate(messages: Message[], options?: GenerateOptions): Promise<string>;
  stream(messages: Message[], options?: StreamOptions): AsyncIterable<StreamChunk>;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface StreamOptions extends GenerateOptions {
  onChunk?: (chunk: StreamChunk) => void;
}

/**
 * Adapter to convert LMClient to AsyncIterable streaming
 * Works with existing LMClient interface
 */
export class LMStreamAdapter {
  constructor(private client: any) {}

  async *stream(messages: Message[], options?: StreamOptions): AsyncIterable<StreamChunk> {
    // Send typing status
    yield {
      type: 'status',
      content: 'typing',
      done: false,
    };

    try {
      // Check if client supports native streaming
      if (this.client.stream || this.client.generateStream) {
        yield* this.nativeStream(messages, options);
      } else {
        // Simulate streaming by character/token
        yield* this.simulatedStream(messages, options);
      }
    } catch (error) {
      yield {
        type: 'error',
        content: String(error),
        done: true,
      };
    }
  }

  private async *nativeStream(messages: Message[], options?: StreamOptions): AsyncIterable<StreamChunk> {
    // Use native streaming if available
    const stream = await this.client.stream(
      this.buildPrompt(messages),
      options
    );

    for await (const chunk of stream) {
      yield {
        type: 'text',
        content: chunk.text || chunk.content || '',
        done: false,
      };
    }

    yield {
      type: 'text',
      content: '',
      done: true,
    };
  }

  private async *simulatedStream(messages: Message[], options?: StreamOptions): AsyncIterable<StreamChunk> {
    // Generate full response
    const response = await this.client.generateText(
      this.buildPrompt(messages),
      options
    );

    // Stream character by character (simulated)
    const words = response.split(' ');
    for (const word of words) {
      yield {
        type: 'text',
        content: word + ' ',
        done: false,
      };
      // Small delay for realistic streaming effect
      await this.delay(10);
    }

    yield {
      type: 'text',
      content: '',
      done: true,
    };
  }

  private buildPrompt(messages: Message[]): string {
    return messages.map(m => `${m.role}: ${m.content}`).join('\n');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

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
