import {TransformersJSEmbeddingModel} from '@browser-ai/transformers-js';

export interface EmbeddingGenerator {
    dimension: number;

    generate(text: string): Promise<number[]>;
}

export class TransformersEmbeddingGenerator implements EmbeddingGenerator {
    readonly dimension = 384;
    private model: TransformersJSEmbeddingModel | null = null;
    private readonly cache = new Map<string, number[]>();
    private readonly cacheSize: number;

    constructor(cacheSize = 1000) {
        this.cacheSize = cacheSize;
    }

    async generate(text: string): Promise<number[]> {
        if (this.cache.has(text)) {
            return this.cache.get(text)!;
        }

        if (!this.model) {
            this.model = new TransformersJSEmbeddingModel('Xenova/all-MiniLM-L6-v2', {
                device: 'cpu',
                normalize: true,
                pooling: 'mean',
            });
        }

        const result = await this.model.doEmbed({values: [text]});
        const embedding = result.embeddings[0] ?? [];

        if (this.cache.size >= this.cacheSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
        }
        this.cache.set(text, embedding);

        return embedding;
    }
}

export class MockEmbeddingGenerator implements EmbeddingGenerator {
    dimension = 384;

    async generate(text: string): Promise<number[]> {
        const embedding = new Array(this.dimension).fill(0);
        for (let i = 0; i < text.length; i++) {
            embedding[i % this.dimension] += text.charCodeAt(i) / 256;
        }
        const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
        return embedding.map((v) => v / norm);
    }
}

export function createEmbeddingGenerator(useMock = false): EmbeddingGenerator {
    return useMock ? new MockEmbeddingGenerator() : new TransformersEmbeddingGenerator();
}

export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0,
        normA = 0,
        normB = 0;
    for (let i = 0; i < a.length; i++) {
        const ai = a[i] ?? 0;
        const bi = b[i] ?? 0;
        dot += ai * bi;
        normA += ai * ai;
        normB += bi * bi;
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
