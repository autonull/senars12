import type {NAR} from '../nar.js';
import type {TranslationCache, TranslationCacheEntry} from './cache.js';
import type {NLContext} from './understanding.js';

export interface ContextAssemblerOpts {
    tokenBudget?: number;
    maxBeliefs?: number;
    maxDerivations?: number;
    maxGoals?: number;
    maxExamples?: number;
}

export class ContextAssembler {
    private cache: TranslationCache;

    constructor(cache: TranslationCache) {
        this.cache = cache;
    }

    assemble(
        nar: NAR,
        input: string,
        opts: ContextAssemblerOpts = {},
    ): NLContext {
        const {
            maxBeliefs = 15,
            maxDerivations = 5,
            maxGoals = 5,
            maxExamples = 3,
        } = opts;

        const beliefs = this.extractRelatedBeliefs(nar, input, maxBeliefs);
        const recentDerivations = this.extractRecentDerivations(nar, maxDerivations);
        const activeGoals = this.extractActiveGoals(nar, maxGoals);
        const memoryHealth = this.extractMemoryHealth(nar);
        const recentExamples = this.extractRelevantExamples(input, maxExamples);

        return {
            beliefs,
            recentDerivations,
            memoryHealth,
            activeGoals,
            recentExamples,
        };
    }

    private extractRelatedBeliefs(nar: NAR, input: string, max: number): string[] {
        const allBeliefs = nar.getBeliefs();
        const words = new Set(input.toLowerCase().split(/\s+/));

        const scored = allBeliefs.map(b => {
            const term = b.term.toString().toLowerCase();
            const termWords = new Set(term.split(/\s+/));
            let overlap = 0;
            for (const w of words) {
                if (termWords.has(w)) overlap++;
            }
            return {term: b.term.toString(), truth: b.truth, score: overlap};
        });

        return scored
            .filter(b => b.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, max)
            .map(b => {
                const truth = b.truth
                    ? ` :${b.truth.f.toFixed(2)}:${b.truth.c.toFixed(2)}`
                    : '';
                return `${b.term}${truth}`;
            });
    }

    private extractRecentDerivations(nar: NAR, max: number): string[] {
        const beliefs = nar.getBeliefs();
        return beliefs.slice(-max).map(b => {
            const truth = b.truth
                ? ` :${b.truth.f.toFixed(2)}:${b.truth.c.toFixed(2)}`
                : '';
            return `${b.term.toString()}${truth}`;
        });
    }

    private extractActiveGoals(nar: NAR, max: number): string[] {
        const goals = nar.getGoals();
        return goals.slice(0, max).map(g => g.term.toString());
    }

    private extractMemoryHealth(nar: NAR): {pressure: number; totalConcepts: number} {
        const stats = nar.getStatistics();
        return {
            pressure: stats.memoryPressure,
            totalConcepts: stats.totalConcepts,
        };
    }

    private extractRelevantExamples(input: string, max: number): TranslationCacheEntry[] {
        return this.cache.getRelevant(input, max);
    }
}
