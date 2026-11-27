/**
 * MemoryIndex Abstraction — pluggable index backends for term links, embeddings, and recall.
 *
 * Part C of W5: abstraction over the existing MemoryIndex with support for
 * SQLite, VectorDB backends (follow-up).
 */
/** In-memory backend implementation (default). */
export class InMemoryIndex {
    associativeRegistry;
    embeddingVectors = new Map();
    constructor(associativeRegistry) {
        this.associativeRegistry = associativeRegistry ?? new (require('./associative').AssociativeRegistry)();
    }
    recall(layer, term, options) {
        return this.associativeRegistry.recall(layer, term, options);
    }
    associate(layer, from, to, options) {
        return this.associativeRegistry.associate(layer, from, to, options);
    }
    similarity(a, b) {
        const vecA = this.embeddingVectors.get(a.toString());
        const vecB = this.embeddingVectors.get(b.toString());
        if (!vecA || !vecB)
            return 0;
        return cosineSimilarity(vecA, vecB);
    }
    nearest(term, k) {
        const queryVec = this.embeddingVectors.get(term.toString());
        if (!queryVec)
            return [];
        const scores = [];
        for (const [termStr, vec] of this.embeddingVectors) {
            if (termStr === term.toString())
                continue;
            if (!vec)
                continue;
            scores.push({ term: { toString: () => termStr }, score: cosineSimilarity(queryVec, vec) });
        }
        return scores.sort((a, b) => b.score - a.score).slice(0, k);
    }
    setEmbedding(term, vector) {
        this.embeddingVectors.set(term.toString(), vector);
    }
    async compact() {
        // No-op for in-memory
    }
    stats() {
        return {
            termLinks: 0, // TODO: implement link counting
            embeddingVectors: this.embeddingVectors.size,
            layers: this.associativeRegistry.names().length ?? 0,
            memoryUsage: this.embeddingVectors.size * 4 * 384, // rough estimate
        };
    }
    getAssociativeRegistry() {
        return this.associativeRegistry;
    }
}
/** Cosine similarity helper. */
function cosineSimilarity(a, b) {
    if (a.length === 0 || b.length === 0 || a.length !== b.length)
        return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        const ai = a[i];
        const bi = b[i];
        if (ai === undefined || bi === undefined)
            return 0;
        dot += ai * bi;
        normA += ai * ai;
        normB += bi * bi;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}
/** Factory for creating MemoryIndex instances. */
export function createMemoryIndex(backend = 'memory', options) {
    switch (backend) {
        case 'memory':
            return new InMemoryIndex(options?.associativeRegistry);
        case 'sqlite':
            // TODO: implement SQLiteIndex
            return new InMemoryIndex(options?.associativeRegistry);
        case 'vectordb':
            // TODO: implement VectorDBIndex
            return new InMemoryIndex(options?.associativeRegistry);
        default:
            return new InMemoryIndex(options?.associativeRegistry);
    }
}
