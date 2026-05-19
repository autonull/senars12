import type {Message, StreamChunk} from '../BotContext.js';

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
