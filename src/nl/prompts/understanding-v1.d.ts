import type { TranslationCacheEntry } from '../cache';
export declare function buildUnderstandingPrompt(nl: string, opts?: {
    beliefs?: string[];
    recentExamples?: TranslationCacheEntry[];
    lastError?: string | null;
    memorySnapshot?: string;
}): string;
//# sourceMappingURL=understanding-v1.d.ts.map