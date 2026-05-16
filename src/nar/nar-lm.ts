import type {LMClient} from './lm';
import {BidirectionalFeedbackLoop, ProactiveEnricher, StreamingLMClient} from './lm';
import type {SeNARSRegistry} from './lm/providers.js';
import {getQualityModel} from './lm/providers.js';
import type {Memory} from './memory';
import type {Task} from './types';

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
    private readonly feedbackLoop?: BidirectionalFeedbackLoop;
    private readonly enricher?: ProactiveEnricher;
    private readonly streamingClient?: StreamingLMClient;

    constructor(
        private readonly memory: Memory,
        private readonly registry?: SeNARSRegistry,
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

    getQualityModel() {
        return this.registry ? getQualityModel(this.registry) : undefined;
    }

    async processHypothesisWithFeedback(hypothesis: Task): Promise<boolean> {
        const result = this.feedbackLoop ? await this.feedbackLoop.processHypothesis(hypothesis) : null;
        return result !== null;
    }

    async enrichMemory(): Promise<void> {
        await this.enricher?.runEnrichmentCycle();
    }

    async streamResponse(prompt: string, onToken: (token: string) => void, lmClient?: LMClient): Promise<string> {
        if (!lmClient) throw new Error('LM client not configured');
        if (!this.streamingClient) return lmClient.generateText(prompt);
        return this.streamingClient.streamGenerateText(prompt, onToken);
    }

    cancelStream(streamId: string): boolean {
        return this.streamingClient?.cancelStream(streamId) ?? false;
    }

    getEnrichmentStats(): LMEnrichmentStats | null {
        const stats = this.enricher?.getStats();
        return stats ? {
            cycles: stats.enrichmentCycles,
            conceptsEnriched: stats.totalConceptsEnriched,
            hypothesesGenerated: stats.totalHypothesesGenerated
        } : null;
    }

    getFeedbackStats(): FeedbackStats | null {
        return this.feedbackLoop ? {pendingValidations: this.feedbackLoop.getPendingValidations().length} : null;
    }

    getStreamingStats(): LMStreamingStats | null {
        return this.streamingClient?.getStreamManager().getStats() ?? null;
    }
}
