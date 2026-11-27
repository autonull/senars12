import type { AmbiguityFlag, FormalizationBatch } from '@senars/schemas/formalization';
import type { ILMService } from '../lm/interfaces';
import type { TranslationCache, TranslationCacheEntry } from './cache';
import { type FirewallOptions, SymbolicFirewall } from './firewall';
/** Canonical definitions live in types/events (EventMap depends on them); re-exported here for the nl surface. */
export type { Ambiguity, Coreference, TaskBatch } from '../types/events';
import type { TaskBatch } from '../types/events';
export interface NLContext {
    beliefs?: string[];
    recentDerivations?: string[];
    memoryHealth?: {
        pressure: number;
        totalConcepts: number;
    };
    activeGoals?: string[];
    recentExamples?: TranslationCacheEntry[];
}
export declare class NLUnderstandingService {
    private readonly lm;
    private structuredOnly;
    private readonly firewall;
    private readonly flight;
    private readonly cache?;
    constructor(lm: ILMService | null, cache: TranslationCache | undefined, opts?: {
        structuredOnly?: boolean;
        firewall?: FirewallOptions | SymbolicFirewall;
    });
    understand(input: string, ctx?: NLContext, maxRetries?: number): Promise<TaskBatch | null>;
    private fromCached;
    private toCached;
    private understandInner;
    understandCandidates(input: string, ctx?: NLContext): Promise<FormalizationBatch | null>;
    sanitize(batch: TaskBatch): TaskBatch;
    private structuredTranslate;
    private jsonFallbackTranslate;
    private narseseFallbackTranslate;
    private translateWithLM;
    private isValidNarsese;
    private extractNarseseFromText;
}
/**
 * One flag per pattern the input matches, its severity read from the kernel's
 * kind table rather than spelled beside the pattern — a second place to keep in step.
 */
export declare function detectAmbiguityFlags(input: string): AmbiguityFlag[];
export declare function locateSpan(input: string, sourceText?: string): {
    start: number;
    end: number;
    text: string;
};
export declare function toFormalizationBatch(input: string, batch: TaskBatch): FormalizationBatch;
//# sourceMappingURL=understanding.d.ts.map