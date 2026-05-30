import type {Message, StreamChunk} from '../BotContext.js';
import type {GenerateOptions, StreamOptions} from './types.js';

interface StreamableLMClient {
  generateText(prompt: string, options?: GenerateOptions): Promise<string>;
  stream?(prompt: string, options?: StreamOptions): AsyncIterable<{text?: string; content?: string}>;
  generateStream?(prompt: string, options?: StreamOptions): AsyncIterable<{text?: string; content?: string}>;
}

/**
 * Adapter to convert LMClient to AsyncIterable streaming
 * Works with existing LMClient interface
 */
export class LMStreamAdapter {
  constructor(private client: StreamableLMClient) {}

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
    } catch (error: unknown) {
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : String(error),
        done: true,
      };
    }
  }

  private async *nativeStream(messages: Message[], options?: StreamOptions): AsyncIterable<StreamChunk> {
    const streamFn: ((prompt: string, options?: StreamOptions) => AsyncIterable<{text?: string; content?: string}>) | undefined = this.client.stream ?? this.client.generateStream;
    if (!streamFn) return;

    const stream = await streamFn.call(this.client,
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

    // Stream word by word (simulated)
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
