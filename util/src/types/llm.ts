export interface LMService {
  complete(prompt: string, options?: LMCompletionOptions): Promise<LMResult>;
  stream?(prompt: string, options?: LMCompletionOptions): AsyncIterable<string>;
}

export interface LMCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  signal?: AbortSignal;
  system?: string;
}

export interface LMResult {
  text: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}
