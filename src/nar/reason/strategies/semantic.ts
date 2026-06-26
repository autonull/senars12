import type {Task} from '../../types';
import {createSecondaryTask} from '../../types';
import type {Memory} from '../../memory';
import type {Concept} from '../../memory';
import type {Strategy} from '../strategy.js';
import type {Term} from '../../terms';

interface SemanticStrategyConfig {
    minSimilarity?: number;
    maxResults?: number;
    linkWeight?: number;
    embeddingWeight?: number;
    priorityWeight?: number;
}

export class SemanticStrategy implements Strategy {
    readonly name = 'semantic';
    private readonly config: Required<SemanticStrategyConfig>;

    constructor(config?: SemanticStrategyConfig) {
        this.config = {
            minSimilarity: config?.minSimilarity ?? 0.6,
            maxResults: config?.maxResults ?? 10,
            linkWeight: config?.linkWeight ?? 0.5,
            embeddingWeight: config?.embeddingWeight ?? 0.3,
            priorityWeight: config?.priorityWeight ?? 0.2,
        };
    }

    selectSecondary(task: Task, memory: Memory): Task[] {
        const candidates = memory.listConcepts().filter(c => c.term.toString() !== task.term.toString());
        return this.scoreAndSelect(task.term, candidates, memory);
    }

    private scoreAndSelect(primary: Term, candidates: Concept[], memory: Memory): Task[] {
        const linkManager = memory.getLinkManager();
        const primaryStr = primary.toString();

        const scored = candidates.map(c => {
            const termStr = c.term.toString();
            const linkStrength = linkManager
                ? this.getLinkStrength(linkManager, primary, termStr)
                : 0;

            const embeddingSim = this.getEmbeddingSimilarity(memory, primaryStr, termStr);
            const priorityScore = c.priority;

            const score = linkStrength * this.config.linkWeight
                + embeddingSim * this.config.embeddingWeight
                + priorityScore * this.config.priorityWeight;

            return {concept: c, score};
        });

        return scored
            .filter(s => s.score >= this.config.minSimilarity)
            .sort((a, b) => b.score - a.score)
            .slice(0, this.config.maxResults)
            .map(s => this.conceptToTask(s.concept));
    }

    private getLinkStrength(linkManager: NonNullable<ReturnType<Memory['getLinkManager']>>, primary: Term, targetStr: string): number {
        const links = linkManager.getLinks(primary, {minPriority: 0});
        const match = links.find(l => l.targetTerm.toString() === targetStr);
        return match ? match.priority : 0;
    }

    private getEmbeddingSimilarity(memory: Memory, termA: string, termB: string): number {
        const memWithEmbedding = memory as Memory & {
            getEmbeddingLayer?: () => { similarity: (a: string, b: string) => number } | null
        };
        const embeddingLayer = memWithEmbedding.getEmbeddingLayer?.();
        if (!embeddingLayer?.similarity) return 0;
        return embeddingLayer.similarity(termA, termB);
    }

    private conceptToTask(concept: Concept): Task {
        const belief = concept.beliefBag.peek();
        return createSecondaryTask(
            concept.term,
            concept.priority,
            belief?.truth ? {f: belief.truth.f, c: belief.truth.c} : undefined,
            'belief',
        );
    }
}

export const createSemanticStrategy = (config?: SemanticStrategyConfig): Strategy => {
    return new SemanticStrategy(config);
};
