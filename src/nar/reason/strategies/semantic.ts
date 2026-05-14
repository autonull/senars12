import type {Task} from '../../types';
import {createSecondaryTask} from '../../types';
import type {Memory} from '../../memory';
import type {Strategy} from '../strategy.js';

interface SimilarTerm {
    term: string;
    score: number;
    termObj: unknown;
}

interface SemanticStrategyConfig {
    minSimilarity?: number;
    maxResults?: number;
}

export class SemanticStrategy implements Strategy {
    readonly name = 'semantic';
    private readonly minSimilarity: number;
    private readonly maxResults: number;

    constructor(config?: SemanticStrategyConfig) {
        this.minSimilarity = config?.minSimilarity ?? 0.6;
        this.maxResults = config?.maxResults ?? 10;
    }

    selectSecondary(task: Task, memory: Memory): Task[] {
        const memoryWithEmbedding = memory as Memory & { getEmbeddingLayer?: () => unknown };
        const embeddingLayer = memoryWithEmbedding.getEmbeddingLayer?.();
        if (!embeddingLayer) return [];

        const termKey = task.term.kind === 'atom' ? task.term.symbol : task.term.kind;
        const embedding = (embeddingLayer as {
            getEmbedding?: (term: string) => unknown
        }).getEmbedding?.(termKey);
        if (!embedding) return [];

        const similar = (embeddingLayer as {
            findSimilar?: (embedding: unknown, options: { minScore: number; maxResults: number }) => SimilarTerm[]
        }).findSimilar?.(embedding, {
            minScore: this.minSimilarity,
            maxResults: this.maxResults,
        });

        if (!similar || similar.length === 0) return [];

        const linkManager = memory.getLinkManager();

        if (linkManager) {
            for (const {term: termStr, score} of similar) {
                // For now, skip semantic linking as it requires term registry
                // This would need reconstruction from term string
            }
        }

        return this.similarToTasks(similar, memory);
    }

    private similarToTasks(similar: SimilarTerm[], memory: Memory): Task[] {
        const results: Task[] = [];

        for (const {term: termStr} of similar) {
            const allConcepts = memory.listConcepts();
            const concept = allConcepts.find(c => {
                const cTerm = c.term;
                const cStr = cTerm.kind === 'atom' ? cTerm.symbol : cTerm.kind;
                return cStr === termStr;
            });
            if (!concept) continue;

            const belief = concept.beliefBag?.peek();
            if (!belief) continue;

            const secondaryTask = createSecondaryTask(
                concept.term,
                0.5,
                belief.truth ? {f: belief.truth.f, c: belief.truth.c} : undefined,
                'belief'
            );

            results.push(secondaryTask);
        }

        return results;
    }
}

export const createSemanticStrategy = (config?: SemanticStrategyConfig): Strategy => {
    return new SemanticStrategy(config);
};
