import { TransformersJSEmbeddingModel } from '@browser-ai/transformers-js';
import { l2Normalize } from '@senars/util/similarity';
/**
 * What the core can know with no composition root bound: no provider is
 * configured, so embeddings degrade to the deterministic generator. Guessing
 * `transformers` here would make a bare `new Memory()` pull a second heavy
 * runtime into the process.
 */
export const DEFAULT_EMBEDDING_RUNTIME = {
    provider: 'none',
    device: 'cpu',
    dtype: 'fp32',
};
export const DEFAULT_EMBEDDING_MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
export const DEFAULT_EMBEDDING_DIMENSION = 384;
export class TransformersEmbeddingGenerator {
    runtime;
    dimension;
    modelId;
    model = null;
    constructor(runtime, modelId = DEFAULT_EMBEDDING_MODEL_ID, dimension = DEFAULT_EMBEDDING_DIMENSION) {
        this.runtime = runtime;
        this.modelId = modelId;
        this.dimension = dimension;
    }
    async generate(text) {
        if (!this.model) {
            // Embeddings ride the same settings rails (device/dtype/cacheDir) as chat models.
            const settings = this.runtime();
            this.model = new TransformersJSEmbeddingModel(this.modelId, {
                device: settings.device,
                dtype: settings.dtype ?? (settings.quantized ? 'q4' : 'fp32'),
                ...(settings.cacheDir ? { cacheDir: settings.cacheDir } : {}),
                normalize: true,
                pooling: 'mean',
            });
        }
        const result = await this.model.doEmbed({ values: [text] });
        return result.embeddings[0] ?? [];
    }
}
export class MockEmbeddingGenerator {
    dimension;
    modelId = 'mock';
    constructor(dimension = DEFAULT_EMBEDDING_DIMENSION) {
        this.dimension = dimension;
    }
    async generate(text) {
        const embedding = new Array(this.dimension).fill(0);
        for (let i = 0; i < text.length; i++) {
            embedding[i % this.dimension] += text.charCodeAt(i) / 256;
        }
        return l2Normalize(embedding);
    }
}
/**
 * The transformers (`MiniLM`) provider is the only real embedder *here*; any
 * other posture degrades to the deterministic generator rather than dragging a
 * second heavy runtime into this cycle-path module. The embedded llama.cpp
 * provider has its own real generator, chosen outside the core by
 * `resolveEmbeddingGenerator` (`nar/src/lm/embedding-runtime.ts`) — this module
 * cannot name it without the core importing the induction layer.
 */
export const isMockLM = (runtime) => runtime().provider !== 'transformers';
export function createEmbeddingGenerator(runtime = () => DEFAULT_EMBEDDING_RUNTIME, config) {
    const { useMock = isMockLM(runtime), ...generatorConfig } = config ?? {};
    if (useMock) {
        return new MockEmbeddingGenerator(generatorConfig.dimension ?? DEFAULT_EMBEDDING_DIMENSION);
    }
    return new TransformersEmbeddingGenerator(runtime, generatorConfig.modelId, generatorConfig.dimension);
}
export { cosine as cosineSimilarity } from '@senars/util/similarity';
