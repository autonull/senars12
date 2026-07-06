import { Logger } from '../util/Logger.js';
import { dotProduct, euclideanNorm } from '../util/math.js';

export class EmbeddingLayer {
    constructor(config = {}) {
        this.config = {
            enabled: true,
            model: config.model || 'text-embedding-ada-002',
            maxBatchSize: config.maxBatchSize || 10,
            cacheSize: config.cacheSize || 1000,
            ...config
        };

        this.embeddingCache = new Map();
        this.enabled = this.config.enabled;
    }

    async getEmbedding(input) {
        if (!this.enabled) {
            throw new Error('EmbeddingLayer is not enabled');
        }

        const inputStr = typeof input === 'string' ? input : input.toString();

        if (this.embeddingCache.has(inputStr)) {
            return this.embeddingCache.get(inputStr);
        }

        const embedding = await this._generateEmbedding(inputStr);
        this._updateCache(inputStr, embedding);

        return embedding;
    }

    calculateSimilarity(embedding1, embedding2) {
        if (!this._validateEmbeddings(embedding1, embedding2)) {
            return 0;
        }

        const dot = dotProduct(embedding1, embedding2);
        const mag1 = euclideanNorm(embedding1);
        const mag2 = euclideanNorm(embedding2);

        return (mag1 === 0 || mag2 === 0) ? 0 : dot / (mag1 * mag2);
    }

    async findSimilar(input, candidates, threshold = 0.7) {
        if (!this.enabled) {
            return [];
        }

        const inputEmbedding = await this.getEmbedding(input);
        const results = [];

        for (const candidate of candidates) {
            const candidateEmbedding = await this.getEmbedding(candidate);
            const similarity = this.calculateSimilarity(inputEmbedding, candidateEmbedding);

            if (similarity >= threshold) {
                results.push({
                    item: candidate,
                    similarity
                });
            }
        }

        return results.sort((a, b) => b.similarity - a.similarity);
    }

    async _generateEmbedding(text) {
        if (this.config.model && this.config.model !== 'mock' && !this.config.model.startsWith('mock')) {
            try {
                if (!this._pipeline) {
                    Logger.info(`EmbeddingLayer: Loading pipeline for model ${this.config.model}...`);
                    const { pipeline } = await import('@huggingface/transformers');
                    this._pipeline = await pipeline('feature-extraction', this.config.model);
                    Logger.info(`EmbeddingLayer: Pipeline loaded.`);
                }
                const output = await this._pipeline(text, { pooling: 'mean', normalize: true });
                return Array.from(output.data);
            } catch (e) {
                Logger.warn(`EmbeddingLayer: Failed to load/use model ${this.config.model}, falling back to mock. Error: ${e.message}`);
            }
        }

        const hash = this._simpleHash(text);
        const embedding = new Array(1536).fill(0);

        for (let i = 0; i < embedding.length; i++) {
            embedding[i] = Math.sin(hash + i) * 0.5 + 0.5;
        }

        return embedding;
    }

    _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash &= hash;
        }
        return Math.abs(hash);
    }

    _updateCache(key, value) {
        if (this.embeddingCache.size >= this.config.cacheSize) {
            const firstKey = this.embeddingCache.keys().next().value;
            this.embeddingCache.delete(firstKey);
        }
        this.embeddingCache.set(key, value);
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }

    clearCache() {
        this.embeddingCache.clear();
    }

    getStats() {
        return {
            enabled: this.enabled,
            cacheSize: this.embeddingCache.size,
            config: this.config
        };
    }
}