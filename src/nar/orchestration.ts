export type ActionTier = 'ACT' | 'HYPOTHESIZE' | 'IGNORE';

export class OrchestrationGuide {
    private readonly maxChainDepth: number;

    constructor(maxChainDepth = 3) {
        this.maxChainDepth = maxChainDepth;
    }

    evaluate(truth: {f: number; c: number}): ActionTier {
        if (truth.c < 0.3) return 'IGNORE';
        if (truth.f > 0.6 && truth.c > 0.5) return 'ACT';
        return 'HYPOTHESIZE';
    }

    expectation(truth: {f: number; c: number}): number {
        return truth.c * (truth.f - 0.5) + 0.5;
    }

    calibrateLLMConfidence(truth: {f: number; c: number}): {f: number; c: number} {
        return {
            f: truth.f,
            c: Math.max(0, Math.min(1, truth.c - 0.15)),
        };
    }

    noveltyDiscount(_concept: {term: string}, truth: {f: number; c: number}): {f: number; c: number} {
        return {
            f: truth.f * 0.95,
            c: truth.c * 0.98,
        };
    }

    getMaxChainDepth(): number {
        return this.maxChainDepth;
    }
}