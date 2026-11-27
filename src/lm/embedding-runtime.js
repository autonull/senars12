/**
 * The embedding runtime's view of provider settings.
 *
 * `nar/src/memory/embedding.ts` owns the embedder and declares what it is
 * allowed to know about its host (`EmbeddingRuntime`); this is the one place
 * that answers. Keeping the read here is what lets the core stop importing the
 * induction layer for a configuration value (TODO29.a §5.2).
 */
import { basename } from 'node:path';
import { createEmbeddingGenerator, } from '../memory/embedding';
import { LlamaCppEmbeddingGenerator } from './providers/embedded-embedding';
import { detectDevice, getLMSettings } from './providers';
export const embeddingRuntime = () => {
    const settings = getLMSettings();
    return {
        provider: settings.provider,
        device: detectDevice(),
        dtype: settings.dtype,
        quantized: settings.quantized,
        cacheDir: settings.cacheDir,
    };
};
/**
 * Pick the real embedder for the active provider. The core cannot: naming the
 * embedded llama.cpp generator would make `memory/` import the induction layer.
 * A `llamacpp-embedded` deployment embeds with the loaded GGUF (no mock); every
 * other posture rides `createEmbeddingGenerator`, which is transformers-or-mock.
 */
export const resolveEmbeddingGenerator = (runtime = embeddingRuntime, config) => {
    if (config?.useMock || runtime().provider !== 'llamacpp-embedded') {
        return createEmbeddingGenerator(runtime, config);
    }
    const modelPath = getLMSettings().llamacppModelPath;
    return new LlamaCppEmbeddingGenerator(modelPath ? basename(modelPath) : 'llamacpp-embedded');
};
