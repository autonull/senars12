import type { LMService, SeNARSRegistry } from './lm';
import { BidirectionalFeedbackLoop, getQualityModel, ProactiveEnricher, shadowValidator } from './lm';
import type { Memory } from './memory';
import type { Task } from './types';
import { createSystemOneLMRuleAdapter } from './lm/system-one/rule-adapter.js';

export interface LMEnrichmentStats {
  cycles: number;
  conceptsEnriched: number;
  hypothesesGenerated: number;
}

export interface FeedbackStats {
  pendingValidations: number;
}

/** F5: System One accessors wiring the adapter-driven consumers (shadow conflict head, novelty gate). */
export interface NARLMSystemOneDeps {
  getDispatcher: () => unknown;
  getManifold: () => unknown;
  getEmbeddingCache: () => unknown;
}

export class NARLM {
  private readonly feedbackLoop?: BidirectionalFeedbackLoop;
  private readonly enricher?: ProactiveEnricher;

  constructor(
    private readonly memory: Memory,
    private readonly registry?: SeNARSRegistry,
    lmService?: LMService,
    enableBidirectionalFeedback?: boolean,
    enableProactiveEnrichment?: boolean,
    systemOneDeps?: NARLMSystemOneDeps
  ) {
    if (lmService) {
      const systemOne =
        systemOneDeps && systemOneDeps.getManifold()
          ? {
              adapter: createSystemOneLMRuleAdapter({
                dispatcher: systemOneDeps.getDispatcher() as Parameters<typeof createSystemOneLMRuleAdapter>[0]['dispatcher'],
                nar: {
                  getCycleCount: () => 0,
                  getSystemOneEmbeddingCache: systemOneDeps.getEmbeddingCache,
                  getSystemOneManifold: systemOneDeps.getManifold,
                },
              }),
            }
          : undefined;
      if (systemOne) shadowValidator.setSystemOne(systemOne);
      if (enableBidirectionalFeedback) {
        this.feedbackLoop = new BidirectionalFeedbackLoop(memory, lmService);
      }
      if (enableProactiveEnrichment) {
        this.enricher = new ProactiveEnricher(memory, lmService, {}, systemOne);
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
      ? { pendingValidations: this.feedbackLoop.getPendingValidations().length }
      : null;
  }
}
