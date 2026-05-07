import { Ollama } from 'ollama';
import type { LMClient, LMConfig } from './types.js';

export interface OllamaLMConfig extends LMConfig {
  model?: string;
  baseUrl?: string;
}

export class OllamaLMClient implements LMClient {
  private client: InstanceType<typeof Ollama>;
  private config: OllamaLMConfig;
  private callLog: Array<{ prompt: string; response: string; duration: number }> = [];

  constructor(config: OllamaLMConfig = {}) {
    this.config = {
      model: config.model || 'llama3.2',
      baseUrl: config.baseUrl || 'http://localhost:11434',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 1024,
    };

    this.client = new Ollama({
      host: this.config.baseUrl,
    });
  }

  async generateText(prompt: string, options?: LMConfig): Promise<string> {
    const startTime = Date.now();

    try {
      const response = await this.client.generate({
        model: this.config.model || 'llama3.2',
        prompt,
        options: {
          temperature: options?.temperature ?? this.config.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? this.config.maxTokens ?? 1024,
        },
      });

      const duration = Date.now() - startTime;
      this.callLog.push({ prompt, response: response.response, duration });

      return response.response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.callLog.push({
        prompt,
        response: `ERROR: ${error instanceof Error ? error.message : String(error)}`,
        duration,
      });
      throw error;
    }
  }

  getCallLog() {
    return [...this.callLog];
  }

  getLastCall() {
    return this.callLog[this.callLog.length - 1] ?? null;
  }

  getCallCount(): number {
    return this.callLog.length;
  }

  clearLog() {
    this.callLog = [];
  }
}

export const createOllamaLMClient = (config?: OllamaLMConfig): OllamaLMClient => {
  return new OllamaLMClient(config);
};
