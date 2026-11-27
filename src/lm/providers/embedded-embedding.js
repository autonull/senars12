import { getEmbeddingContext } from '../runtime/llama-runtime';
import { ensureRuntimeLoaded } from './embedded-llamacpp';
export class LlamaCppEmbeddingGenerator {
    modelId;
    #dimension = 0;
    /** The model's vector width; 0 until the first embedding reveals it. */
    get dimension() {
        return this.#dimension;
    }
    constructor(modelId = 'llamacpp-embedded') {
        this.modelId = modelId;
    }
    async generate(text) {
        await ensureRuntimeLoaded();
        const context = await getEmbeddingContext();
        const { vector } = await context.getEmbeddingFor(text);
        const embedding = Array.from(vector);
        this.#dimension = embedding.length;
        return embedding;
    }
}
