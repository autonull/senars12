import { join } from 'node:path';
import { collectUpTo } from '@senars/util/collections';
import { createLogger } from '@senars/util/logger';
import { errMsg } from '@senars/util/error';
import { LruCache } from '@senars/util/lru-cache';
import { overlapCount, tokenizeWords } from '@senars/util/text';
import { periodic } from '@senars/util/async';
import { readJsonFileSync, writeJsonFileSync } from '@senars/util/fs';
const logger = createLogger({ scope: 'nl:cache' });
const DEFAULTS = { maxSize: 500, flushInterval: 100, ttlMs: 60 * 60 * 1000 };
export class TranslationCache {
    #cache;
    flushCounter = 0;
    flushInterval;
    ttlMs;
    stopFlushTimer;
    constructor(opts) {
        this.ttlMs = opts?.ttlMs ?? DEFAULTS.ttlMs;
        this.#cache = new LruCache({ maxSize: opts?.maxSize ?? DEFAULTS.maxSize, ttlMs: this.ttlMs });
        this.flushInterval = opts?.flushInterval ?? DEFAULTS.flushInterval;
        if (opts?.basePath) {
            this.loadFromFile(opts.basePath);
            this.startAutoFlush(opts.basePath);
        }
    }
    record(nl, result) {
        this.#cache.set(nl.toLowerCase(), { nl, result, timestamp: Date.now() });
        if (++this.flushCounter >= this.flushInterval)
            this.flushCounter = 0;
    }
    get(nl) {
        return this.#cache.get(nl.toLowerCase())?.result ?? null;
    }
    getRelevant(nl, max = 3) {
        const words = tokenizeWords(nl);
        return collectUpTo(this.#cache.values(), max, (entry) => overlapCount(words, tokenizeWords(entry.nl)) > 0 ? entry : undefined);
    }
    serialize() {
        return { entries: this.#cache.toArray(), version: 1 };
    }
    deserialize(data) {
        this.#cache.clear();
        const cutoff = Date.now() - this.ttlMs;
        for (const entry of data.entries) {
            if (entry.timestamp >= cutoff)
                this.#cache.set(entry.nl.toLowerCase(), entry);
        }
    }
    saveToFile(basePath) {
        try {
            writeJsonFileSync(join(basePath, 'translation-cache.json'), this.serialize());
        }
        catch (error) {
            logger.warn(`translation cache save failed: ${errMsg(error)}`);
        }
    }
    loadFromFile(basePath) {
        try {
            this.deserialize(readJsonFileSync(join(basePath, 'translation-cache.json'), {
                entries: [],
                version: 1,
            }));
        }
        catch (error) {
            logger.warn(`translation cache load failed: ${errMsg(error)}`);
        }
    }
    close() {
        this.stopFlushTimer?.();
        this.stopFlushTimer = undefined;
    }
    startAutoFlush(basePath) {
        this.stopFlushTimer = periodic(() => this.saveToFile(basePath), 5 * 60 * 1000);
    }
}
