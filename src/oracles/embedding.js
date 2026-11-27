/**
 * Embedding/Representation Oracle — wraps contrastive learning, hard-negative mining,
 * and embedding cache through the oracle seam.
 */
import { createHash } from 'crypto';
import { mineHardNegatives } from '../lm/system-one/hard-negatives';
import { SenarsError } from '../errors/senars-error';
/** Embedding Oracle implementation. */
export class EmbeddingOracle {
    operation;
    provider;
    version;
    budgetResource;
    embeddingGenerator;
    embeddingCache;
    contrastiveMemory;
    beliefSource;
    episodicMemory;
    pinStore = null;
    isReplay = false;
    defaultBudgetSlice;
    stats = {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        pinnedCalls: 0,
        totalDurationMs: 0,
    };
    constructor(config) {
        this.operation = config.operation;
        this.provider = config.provider;
        this.version = config.version;
        this.budgetResource = config.budgetResource;
        this.defaultBudgetSlice = config.budgetSlice;
        this.embeddingGenerator = config.embeddingGenerator;
        this.embeddingCache = config.embeddingCache;
        this.contrastiveMemory = config.contrastiveMemory;
        this.beliefSource = config.beliefSource;
        this.episodicMemory = config.episodicMemory;
    }
    setPinStore(store) {
        this.pinStore = store;
    }
    setReplayMode(replay) {
        this.isReplay = replay;
    }
    async call(input, budgetSlice) {
        const effectiveBudgetSlice = budgetSlice ?? this.defaultBudgetSlice;
        if (effectiveBudgetSlice && this.budgetResource) {
            const { consume } = await import('../budget/budget');
            const charged = consume(effectiveBudgetSlice, this.budgetResource, 1);
            if (!charged) {
                const callId = crypto.randomUUID();
                const startTs = Date.now();
                this.stats.totalCalls++;
                this.stats.failedCalls++;
                const error = `Budget exhausted for ${this.budgetResource}`;
                return {
                    value: null,
                    meta: { callId, ts: startTs, durationMs: 0, provider: this.provider, version: this.version, pinned: false, error },
                };
            }
        }
        const callId = crypto.randomUUID();
        const startTs = Date.now();
        let pinned = false;
        let error;
        let value;
        this.stats.totalCalls++;
        try {
            if (this.isReplay && this.pinStore) {
                const pinnedValue = await this.pinStore.getPin(this.operation, input.args, this.provider, this.version, input.context);
                if (pinnedValue !== null) {
                    this.stats.pinnedCalls++;
                    this.stats.successfulCalls++;
                    return {
                        value: pinnedValue,
                        meta: { callId, ts: startTs, durationMs: 0, provider: this.provider, version: this.version, pinned: true },
                    };
                }
            }
            value = await this.execute(input);
            this.stats.successfulCalls++;
            if (!this.isReplay && this.pinStore) {
                await this.pinStore.pin(this.operation, this.hashInput(input.args), this.provider, this.version, input.context, value);
            }
        }
        catch (e) {
            this.stats.failedCalls++;
            error = e instanceof Error ? e.message : String(e);
            throw e;
        }
        finally {
            const durationMs = Date.now() - startTs;
            this.stats.totalDurationMs += durationMs;
        }
        return {
            value,
            meta: { callId, ts: startTs, durationMs: Date.now() - startTs, provider: this.provider, version: this.version, pinned, error },
        };
    }
    async execute(input) {
        switch (this.operation) {
            case 'embedding.generate': {
                const args = input.args;
                const [text] = args;
                if (this.embeddingCache) {
                    const pointer = await this.embeddingCache.write(text);
                    const embedding = this.embeddingCache.read(pointer);
                    if (embedding)
                        return embedding.slice();
                }
                const generated = await this.embeddingGenerator.generate(text);
                return new Float32Array(generated);
            }
            case 'embedding.rerank': {
                const args = input.args;
                const [candidates, query, topK = 10] = args;
                if (!this.embeddingCache) {
                    const fallbackResult = { reranked: candidates.slice(0, topK).map((c, i) => ({ candidate: c, score: 1 - i * 0.1, reason: 'fallback' })) };
                    return fallbackResult;
                }
                const queryPointer = await this.embeddingCache.write(query);
                const queryEmbedding = this.embeddingCache.read(queryPointer);
                if (!queryEmbedding) {
                    const fallbackResult = { reranked: candidates.slice(0, topK).map((c, i) => ({ candidate: c, score: 1 - i * 0.1, reason: 'fallback' })) };
                    return fallbackResult;
                }
                const results = await Promise.all(candidates.map(async (candidate) => {
                    const pointer = await this.embeddingCache.write(candidate);
                    const embedding = this.embeddingCache.read(pointer);
                    if (!embedding)
                        return { candidate, score: 0, reason: 'no-embedding' };
                    const score = this.cosineSimilarity(queryEmbedding, embedding);
                    return { candidate, score, reason: 'embedding-similarity' };
                }));
                results.sort((a, b) => b.score - a.score);
                const rerankResult = { reranked: results.slice(0, topK) };
                return rerankResult;
            }
            case 'embedding.contrastiveScore': {
                const args = input.args;
                const [embedding, rubric] = args;
                if (!this.contrastiveMemory)
                    return 0.5;
                const score = this.contrastiveMemory.score(embedding, rubric) ?? 0.5;
                return score;
            }
            case 'embedding.mineHardNegatives': {
                const args = input.args;
                const [beliefs, episodicErrors, options] = args;
                const beliefSource = {
                    getBeliefs: () => beliefs.map(b => ({ term: b.term, truth: { f: b.truth.f } })),
                };
                const episodic = episodicErrors ? {
                    getEpisodes: async () => episodicErrors.map(content => ({ content })),
                } : this.episodicMemory;
                const mined = await mineHardNegatives(beliefSource, episodic, options);
                return mined;
            }
            default:
                throw new SenarsError(`Unknown embedding operation: ${input.operation}`, 'VALIDATION_ERROR');
        }
    }
    cosineSimilarity(a, b) {
        let dot = 0, na = 0, nb = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }
        return dot / (Math.sqrt(na) * Math.sqrt(nb));
    }
    hashInput(args) {
        const json = JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v);
        return createHash('sha256').update(json).digest('hex').substring(0, 32);
    }
    async isAvailable() {
        return true;
    }
    getStats() {
        return { ...this.stats };
    }
}
/** Create an embedding oracle for generation. */
export function createEmbeddingGenerateOracle(embeddingGenerator, embeddingCache, config = {}) {
    return new EmbeddingOracle({
        operation: 'embedding.generate',
        provider: 'embedding',
        version: embeddingGenerator.modelId,
        embeddingGenerator,
        embeddingCache,
        ...config,
    });
}
/** Create an embedding oracle for reranking. */
export function createEmbeddingRerankOracle(embeddingGenerator, embeddingCache, config = {}) {
    return new EmbeddingOracle({
        operation: 'embedding.rerank',
        provider: 'embedding',
        version: embeddingGenerator.modelId,
        embeddingGenerator,
        embeddingCache,
        ...config,
    });
}
/** Create an embedding oracle for contrastive scoring. */
export function createContrastiveScoreOracle(embeddingGenerator, contrastiveMemory, embeddingCache, config = {}) {
    return new EmbeddingOracle({
        operation: 'embedding.contrastiveScore',
        provider: 'contrastive',
        version: embeddingGenerator.modelId,
        embeddingGenerator,
        contrastiveMemory,
        embeddingCache,
        ...config,
    });
}
/** Create an embedding oracle for hard-negative mining. */
export function createHardNegativeMineOracle(embeddingGenerator, beliefSource, episodicMemory, config = {}) {
    return new EmbeddingOracle({
        operation: 'embedding.mineHardNegatives',
        provider: 'hard-negative-miner',
        version: embeddingGenerator.modelId,
        embeddingGenerator,
        beliefSource,
        episodicMemory,
        ...config,
    });
}
/** Register all embedding oracles with the registry. */
export function registerEmbeddingOracles(embeddingGenerator, embeddingCache, contrastiveMemory, beliefSource, episodicMemory, pinStore) {
    const oracles = [
        createEmbeddingGenerateOracle(embeddingGenerator, embeddingCache),
    ];
    if (embeddingCache) {
        oracles.push(createEmbeddingRerankOracle(embeddingGenerator, embeddingCache));
    }
    if (contrastiveMemory && embeddingCache) {
        oracles.push(createContrastiveScoreOracle(embeddingGenerator, contrastiveMemory, embeddingCache));
    }
    if (beliefSource) {
        oracles.push(createHardNegativeMineOracle(embeddingGenerator, beliefSource, episodicMemory));
    }
    if (pinStore) {
        for (const oracle of oracles) {
            oracle.setPinStore(pinStore);
        }
    }
    const { oracleRegistry } = require('./oracle');
    for (const oracle of oracles) {
        oracleRegistry.register(oracle);
    }
    return oracles;
}
