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

export interface SerializedCache {
    entries: TranslationCacheEntry[];
    version: number;
}

export class TranslationCache {
    private cache = new Map<string, TranslationCacheEntry>();
    private maxSize = 500;
    private flushCounter = 0;
    private flushInterval = 100;
    private ttlMs = 60 * 60 * 1000; // 1 hour
    private flushTimer?: NodeJS.Timeout;

    constructor(opts?: {maxSize?: number; flushInterval?: number; ttlMs?: number; basePath?: string}) {
        if (opts?.maxSize) this.maxSize = opts.maxSize;
        if (opts?.flushInterval) this.flushInterval = opts.flushInterval;
        if (opts?.ttlMs) this.ttlMs = opts.ttlMs;
        if (opts?.basePath) {
            this.loadFromFile(opts.basePath);
            this.startAutoFlush(opts.basePath);
        }
    }

    private startAutoFlush(basePath: string): void {
        this.flushTimer = setInterval(() => {
            this.saveToFile(basePath);
        }, 5 * 60 * 1000); // Auto-save every 5 minutes
        this.flushTimer.unref();
    }

    record(nl: string, result: TranslationResult | string): void {
        if (this.cache.size >= this.maxSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest) this.cache.delete(oldest);
        }
        this.cache.set(nl.toLowerCase(), { nl, result, timestamp: Date.now() });

        this.flushCounter++;
        if (this.flushCounter >= this.flushInterval) {
            this.flushCounter = 0;
            // Note: actual file save happens in auto-flush timer
        }
    }

    get(nl: string): TranslationResult | string | null {
        const entry = this.cache.get(nl.toLowerCase());
        if (!entry) return null;

        // Check TTL
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(nl.toLowerCase());
            return null;
        }

        return entry.result;
    }

    getRelevant(nl: string, max = 3): TranslationCacheEntry[] {
        const words = new Set(nl.toLowerCase().split(/\s+/));
        return [...this.cache.values()]
            .filter(e => {
                if (Date.now() - e.timestamp > this.ttlMs) return false;
                return e.nl.toLowerCase().split(/\s+/).some(w => words.has(w));
            })
            .slice(0, max);
    }

    serialize(): SerializedCache {
        const now = Date.now();
        const validEntries = [...this.cache.values()].filter(e => now - e.timestamp <= this.ttlMs);
        return {
            entries: validEntries,
            version: 1,
        };
    }

    deserialize(data: SerializedCache): void {
        this.cache.clear();
        for (const entry of data.entries) {
            if (Date.now() - entry.timestamp <= this.ttlMs) {
                this.cache.set(entry.nl.toLowerCase(), entry);
            }
        }
    }

    saveToFile(basePath: string): void {
        try {
            const fs = require('fs');
            const path = require('path');
            const fullPath = path.join(basePath, 'translation-cache.json');
            const serialized = this.serialize();
            fs.writeFileSync(fullPath, JSON.stringify(serialized), 'utf-8');
        } catch {
            // Ignore save errors
        }
    }

    loadFromFile(basePath: string): void {
        try {
            const fs = require('fs');
            const path = require('path');
            const fullPath = path.join(basePath, 'translation-cache.json');
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const data = JSON.parse(content) as SerializedCache;
                this.deserialize(data);
            }
        } catch {
            // Ignore load errors
        }
    }

    close(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = undefined;
        }
    }
}