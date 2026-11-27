/**
 * The embedding runtime's view of provider settings.
 *
 * `nar/src/memory/embedding.ts` owns the embedder and declares what it is
 * allowed to know about its host (`EmbeddingRuntime`); this is the one place
 * that answers. Keeping the read here is what lets the core stop importing the
 * induction layer for a configuration value (TODO29.a §5.2).
 */
import { type EmbeddingGenerator, type EmbeddingGeneratorConfig, type EmbeddingRuntime, type EmbeddingRuntimeSource } from '../memory/embedding';
export declare const embeddingRuntime: () => EmbeddingRuntime;
/**
 * Pick the real embedder for the active provider. The core cannot: naming the
 * embedded llama.cpp generator would make `memory/` import the induction layer.
 * A `llamacpp-embedded` deployment embeds with the loaded GGUF (no mock); every
 * other posture rides `createEmbeddingGenerator`, which is transformers-or-mock.
 */
export declare const resolveEmbeddingGenerator: (runtime?: EmbeddingRuntimeSource, config?: Partial<EmbeddingGeneratorConfig> & {
    useMock?: boolean;
}) => EmbeddingGenerator;
//# sourceMappingURL=embedding-runtime.d.ts.map