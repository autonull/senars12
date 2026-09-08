import type {LMService, SeNARSRegistry} from './lm';
import {BidirectionalFeedbackLoop, getQualityModel, ProactiveEnricher} from './lm';
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

export class NARLM {
    private readonly feedbackLoop?: BidirectionalFeedbackLoop;
    private readonly enricher?: ProactiveEnricher;

    constructor(
        private readonly memory: Memory,
        private readonly registry?: SeNARSRegistry,
        lmService?: LMService,
        enableBidirectionalFeedback?: boolean,
        enableProactiveEnrichment?: boolean
    ) {
        if (lmService) {
            if (enableBidirectionalFeedback) {
                this.feedbackLoop = new BidirectionalFeedbackLoop(memory, lmService);
            }
            if (enableProactiveEnrichment) {
                this.enricher = new ProactiveEnricher(memory, lmService);
            }
        }
    }

    getFeedbackLoop(): BidirectionalFeedbackLoop | undefined {
        return this.feedbackLoop;
    }

    getEnricher(): ProactiveEnricher | undefined {
        return this.enricher;
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

    getEnrichmentStats(): LMEnrichmentStats | null {
        const stats = this.enricher?.getStats();
        return stats
            ? {
                cycles: stats.enrichmentCycles,
                conceptsEnriched: stats.totalConceptsEnriched,
                hypothesesGenerated: stats.totalHypothesesGenerated,
            }
            : null;
    }

    getFeedbackStats(): FeedbackStats | null {
        return this.feedbackLoop
            ? {pendingValidations: this.feedbackLoop.getPendingValidations().length}
            : null;
    }
}
