import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import type { LMClient, LMConfig } from './types.js';

export interface VercelLMConfig extends LMConfig {
  provider?: 'anthropic' | 'openai';
  model?: string;
}

export class VercelLMClient implements LMClient {
  private model: ReturnType<typeof anthropic>;
  private config: VercelLMConfig;
  private callLog: Array<{ prompt: string; response: string; duration: number }> = [];

  constructor(config: VercelLMConfig = {}) {
    this.config = {
      provider: config.provider || 'anthropic',
      model: config.model || 'claude-3-5-sonnet-20241022',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 1024,
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY || '',
    };

    const modelId = this.config.model || 'claude-3-5-sonnet-20241022';
    this.model = anthropic(modelId);
  }

  async generateText(prompt: string, options?: LMConfig): Promise<string> {
    const startTime = Date.now();

    try {
      const { text } = await generateText({
        model: this.model,
        prompt,
        temperature: options?.temperature ?? this.config.temperature,
        maxOutputTokens: (options?.maxTokens ?? this.config.maxTokens) as number,
      });

      const duration = Date.now() - startTime;
      this.callLog.push({ prompt, response: text, duration });

      return text;
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

export const createVercelLMClient = (config?: VercelLMConfig): VercelLMClient => {
  return new VercelLMClient(config);
};
