import type {LMClient} from './types.js';
import {EventEmitter} from 'events';

export interface StreamConfig {
  enableStreaming: boolean;
  enableCancellation: boolean;
}

export interface StreamEvent {
  type: 'token' | 'complete' | 'error' | 'cancelled';
  data?: string;
  error?: string;
}

export interface StreamHandle {
  id: string;
  abort: () => void;
  promise: Promise<string>;
}

export class LMStreamManager extends EventEmitter {
  private readonly config: StreamConfig;
  private activeStreams: Map<string, AbortController> = new Map();
  private streamIdCounter: number = 0;

  constructor(config: Partial<StreamConfig> = {}) {
    super();
    this.config = {
      enableStreaming: true,
      enableCancellation: true,
      ...config
    };
  }

  async generateWithStreaming(
    client: LMClient,
    prompt: string,
    onToken: (token: string) => void
  ): Promise<string> {
    const id = `stream-${++this.streamIdCounter}`;
    const abortController = new AbortController();
    
    this.activeStreams.set(id, abortController);

    try {
      const response = await client.generateText(prompt);
      
      for (const char of response) {
        if (abortController.signal.aborted) {
          this.emit('cancelled', { id });
          return '';
        }
        onToken(char);
      }

      this.emit('complete', { id, data: response });
      return response;
    } catch (error) {
      if (abortController.signal.aborted) {
        return '';
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('error', { id, error: errorMessage });
      throw error;
    } finally {
      this.activeStreams.delete(String(id));
    }
  }

  cancelStream(streamId: string): boolean {
    const controller = this.activeStreams.get(streamId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(streamId);
      return true;
    }
    return false;
  }

  cancelAllStreams(): void {
    for (const controller of this.activeStreams.values()) {
      controller.abort();
    }
    this.activeStreams.clear();
  }

  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  getStats(): {
    activeStreams: number;
    totalStreams: number;
  } {
    return {
      activeStreams: this.activeStreams.size,
      totalStreams: this.streamIdCounter
    };
  }
}

export class StreamingLMClient {
  private readonly baseClient: LMClient;
  private readonly streamManager: LMStreamManager;

  constructor(baseClient: LMClient, config?: Partial<StreamConfig>) {
    this.baseClient = baseClient;
    this.streamManager = new LMStreamManager(config);
  }

  async streamGenerateText(
    prompt: string,
    onToken: (token: string) => void
  ): Promise<string> {
    return this.streamManager.generateWithStreaming(
      this.baseClient,
      prompt,
      onToken
    );
  }

  cancelStream(streamId: string): boolean {
    return this.streamManager.cancelStream(streamId);
  }

  cancelAllStreams(): void {
    this.streamManager.cancelAllStreams();
  }

  getStreamManager(): LMStreamManager {
    return this.streamManager;
  }
}

export const createLMStreamManager = (config?: Partial<StreamConfig>): LMStreamManager => {
  return new LMStreamManager(config);
};

export const createStreamingLMClient = (baseClient: LMClient, config?: Partial<StreamConfig>): StreamingLMClient => {
  return new StreamingLMClient(baseClient, config);
};
