export interface EmbeddingGenerator {
    dimension: number;
    /** The model's identity for provenance; absent for a generator with none. */
    readonly modelId?: string;
    generate(text: string): Promise<number[]>;
}
export interface EmbeddingGeneratorConfig {
    modelId: string;
    dimension: number;
}
/**
 * What the embedding runtime is allowed to know about its host, in core
 * vocabulary. A *function*, not a value: provider settings are read at first
 * use rather than at construction, so a settings change between two embeddings
 * is picked up without rebuilding the generator.
 *
 * The composition root supplies it (`lm/providers` owns the settings); the core
 * has no way to read them itself without importing the induction layer, which is
 * the edge this type exists to remove (TODO29.a §5.2).
 */
export interface EmbeddingRuntime {
    readonly provider: string;
    readonly device: string;
    readonly dtype?: string;
    readonly quantized?: boolean;
    readonly cacheDir?: string;
}
export type EmbeddingRuntimeSource = () => EmbeddingRuntime;
/**
 * What the core can know with no composition root bound: no provider is
 * configured, so embeddings degrade to the deterministic generator. Guessing
 * `transformers` here would make a bare `new Memory()` pull a second heavy
 * runtime into the process.
 */
export declare const DEFAULT_EMBEDDING_RUNTIME: EmbeddingRuntime;
export declare const DEFAULT_EMBEDDING_MODEL_ID = "Xenova/all-MiniLM-L6-v2";
export declare const DEFAULT_EMBEDDING_DIMENSION = 384;
export declare class TransformersEmbeddingGenerator implements EmbeddingGenerator {
    private readonly runtime;
    readonly dimension: number;
    readonly modelId: string;
    private model;
    constructor(runtime: EmbeddingRuntimeSource, modelId?: string, dimension?: number);
    generate(text: string): Promise<number[]>;
}
export declare class MockEmbeddingGenerator implements EmbeddingGenerator {
    readonly dimension: number;
    readonly modelId = "mock";
    constructor(dimension?: number);
    generate(text: string): Promise<number[]>;
}
/**
 * The transformers (`MiniLM`) provider is the only real embedder *here*; any
 * other posture degrades to the deterministic generator rather than dragging a
 * second heavy runtime into this cycle-path module. The embedded llama.cpp
 * provider has its own real generator, chosen outside the core by
 * `resolveEmbeddingGenerator` (`nar/src/lm/embedding-runtime.ts`) — this module
 * cannot name it without the core importing the induction layer.
 */
export declare const isMockLM: (runtime: EmbeddingRuntimeSource) => boolean;
export declare function createEmbeddingGenerator(runtime?: EmbeddingRuntimeSource, config?: Partial<EmbeddingGeneratorConfig> & {
    useMock?: boolean;
}): EmbeddingGenerator;
export { cosine as cosineSimilarity } from '@senars/util/similarity';
//# sourceMappingURL=embedding.d.ts.map