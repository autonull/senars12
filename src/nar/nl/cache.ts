export interface TranslationCacheEntry {
    nl: string;
    result: TranslationResult | string;
    timestamp: number;
}

export interface TranslationResult {
    beliefs: Array<{narsese: string; truth?: {f: number; c: number}}>;
    questions: string[];
    goals: string[];
    summary: string;
}

export class TranslationCache {
    private cache = new Map<string, TranslationCacheEntry>();
    private maxSize = 500;

    record(nl: string, result: TranslationResult | string): void {
        if (this.cache.size >= this.maxSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest) this.cache.delete(oldest);
        }
        this.cache.set(nl.toLowerCase(), { nl, result, timestamp: Date.now() });
    }

    get(nl: string): TranslationResult | string | null {
        return this.cache.get(nl.toLowerCase())?.result ?? null;
    }

    getRelevant(nl: string, max = 3): TranslationCacheEntry[] {
        const words = new Set(nl.toLowerCase().split(/\s+/));
        return [...this.cache.values()]
            .filter(e => e.nl.toLowerCase().split(/\s+/).some(w => words.has(w)))
            .slice(0, max);
    }
}