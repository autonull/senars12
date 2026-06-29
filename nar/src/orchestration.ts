import {clamp01} from './utils';

export type ActionTier = 'ACT' | 'HYPOTHESIZE' | 'IGNORE';

export class OrchestrationGuide {
    private readonly maxChainDepth: number;
    private noveltyHistory: Map<string, number> = new Map();

    constructor(maxChainDepth = 3) {
        this.maxChainDepth = maxChainDepth;
    }

    evaluate(truth: { f: number; c: number }): ActionTier {
        if (truth.c < 0.3) return 'IGNORE';
        if (truth.f > 0.6 && truth.c > 0.5) return 'ACT';
        return 'HYPOTHESIZE';
    }

    expectation(truth: { f: number; c: number }): number {
        return truth.c * (truth.f - 0.5) + 0.5;
    }

    calibrateLLMConfidence(truth: { f: number; c: number }): { f: number; c: number } {
        return {
            f: truth.f,
            c: clamp01(truth.c - 0.15),
        };
    }

    noveltyDiscount(concept: { term: string }, truth: { f: number; c: number }, noveltyScore?: number): {
        f: number;
        c: number
    } {
        // Dynamic novelty modulation based on novelty score or historical frequency
        const term = concept.term.toString();
        const historicalNovelty = this.noveltyHistory.get(term) ?? 0.5;
        const novelty = noveltyScore ?? historicalNovelty;

        // Apply dynamic discount: higher novelty = stronger discount
        // Novel concepts (novelty > 0.7) get 10% discount, familiar get 2%
        const discountFactor = 1 - (novelty * 0.15); // 0.85 to 1.0 range

        return {
            f: truth.f * discountFactor,
            c: truth.c * (discountFactor * 0.98), // Additional 2% base uncertainty
        };
    }

    recordNovelty(term: string, novelty: number): void {
        this.noveltyHistory.set(term, novelty);
        // Decay old entries
        for (const [key, value] of this.noveltyHistory.entries()) {
            this.noveltyHistory.set(key, value * 0.95);
        }
    }

    getMaxChainDepth(): number {
        return this.maxChainDepth;
    }
}
