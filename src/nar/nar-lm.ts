import type {LMClient} from './lm';
import type {Memory} from './memory';
import type {Task} from './types';
import {BidirectionalFeedbackLoop, ProactiveEnricher, StreamingLMClient} from './lm';

export interface LMEnrichmentStats {
  cycles: number;
  conceptsEnriched: number;
  hypothesesGenerated: number;
}

export interface FeedbackStats {
  pendingValidations: number;
}

export interface LMStreamingStats {
  activeStreams: number;
  totalStreams: number;
}

export class NARLM {
  private feedbackLoop?: BidirectionalFeedbackLoop;
  private enricher?: ProactiveEnricher;
  private streamingClient?: StreamingLMClient;

  constructor(
    private readonly memory: Memory,
    lmClient?: LMClient,
    enableBidirectionalFeedback?: boolean,
    enableProactiveEnrichment?: boolean,
    enableLMStreaming?: boolean
  ) {
    if (lmClient) {
      if (enableBidirectionalFeedback) {
        this.feedbackLoop = new BidirectionalFeedbackLoop(memory, lmClient);
      }
      if (enableProactiveEnrichment) {
        this.enricher = new ProactiveEnricher(memory, lmClient);
      }
      if (enableLMStreaming) {
        this.streamingClient = new StreamingLMClient(lmClient);
      }
    }
  }

  getFeedbackLoop(): BidirectionalFeedbackLoop | undefined {
    return this.feedbackLoop;
  }

  getEnricher(): ProactiveEnricher | undefined {
    return this.enricher;
  }

  getStreamingClient(): StreamingLMClient | undefined {
    return this.streamingClient;
  }

  async processHypothesisWithFeedback(hypothesis: Task): Promise<boolean> {
    if (!this.feedbackLoop) {
      return false;
    }
    const result = await this.feedbackLoop.processHypothesis(hypothesis);
    return result !== null;
  }

  async enrichMemory(): Promise<void> {
    if (!this.enricher) {
      return;
    }
    await this.enricher.runEnrichmentCycle();
  }

  async streamResponse(
    prompt: string,
    onToken: (token: string) => void,
    lmClient?: LMClient
  ): Promise<string> {
    if (!this.streamingClient || !lmClient) {
      if (!lmClient) {
        throw new Error('LM client not configured');
      }
      return lmClient.generateText(prompt);
    }
    return this.streamingClient.streamGenerateText(prompt, onToken);
  }

  cancelStream(streamId: string): boolean {
    if (!this.streamingClient) {
      return false;
    }
    return this.streamingClient.cancelStream(streamId);
  }

  getEnrichmentStats(): LMEnrichmentStats | null {
    if (!this.enricher) {
      return null;
    }
    const stats = this.enricher.getStats();
    return {
      cycles: stats.enrichmentCycles,
      conceptsEnriched: stats.totalConceptsEnriched,
      hypothesesGenerated: stats.totalHypothesesGenerated
    };
  }

  getFeedbackStats(): FeedbackStats | null {
    if (!this.feedbackLoop) {
      return null;
    }
    return {
      pendingValidations: this.feedbackLoop.getPendingValidations().length
    };
  }

  getStreamingStats(): LMStreamingStats | null {
    if (!this.streamingClient) {
      return null;
    }
    const manager = this.streamingClient.getStreamManager();
    return manager.getStats();
  }
}
