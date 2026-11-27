/**
 * Real embeddings from the embedded llama.cpp runtime (CORE.19): the offline
 * vector source the System One encoder reads when a GGUF is configured — no
 * mock, the same model file the chat path loads.
 *
 * The width is the model's own. The embedding cache allocates to the vector it
 * receives and the manifold's scorers hash a fixed sample, so nothing here
 * carries a 384-dimension assumption.
 */
import type { EmbeddingGenerator } from '../../memory/embedding';
export declare class LlamaCppEmbeddingGenerator implements EmbeddingGenerator {
    #private;
    readonly modelId: string;
    /** The model's vector width; 0 until the first embedding reveals it. */
    get dimension(): number;
    constructor(modelId?: string);
    generate(text: string): Promise<number[]>;
}
//# sourceMappingURL=embedded-embedding.d.ts.map