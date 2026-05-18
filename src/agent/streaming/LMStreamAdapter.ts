import type {Message, StreamChunk} from '../BotContext.js';
import type {GenerateOptions, StreamOptions} from './types.js';

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
