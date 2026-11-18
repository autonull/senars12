/**
 * Real embeddings from the embedded llama.cpp runtime (CORE.19): the offline
 * vector source the System One encoder reads when a GGUF is configured — no
 * mock, the same model file the chat path loads.
 *
 * The width is the model's own. The embedding cache allocates to the vector it
 * receives and the manifold's scorers hash a fixed sample, so nothing here
 * carries a 384-dimension assumption.
 */
import type { EmbeddingGenerator } from '../../memory/embedding.js';
import { getEmbeddingContext } from '../runtime/llama-runtime.js';
import { ensureRuntimeLoaded } from './embedded-llamacpp.js';

export class LlamaCppEmbeddingGenerator implements EmbeddingGenerator {
  #dimension = 0;

  /** The model's vector width; 0 until the first embedding reveals it. */
  get dimension(): number {
    return this.#dimension;
  }

  constructor(readonly modelId: string = 'llamacpp-embedded') {}

  async generate(text: string): Promise<number[]> {
    await ensureRuntimeLoaded();
    const context = await getEmbeddingContext();
    const { vector } = await context.getEmbeddingFor(text);
    const embedding = Array.from(vector);
    this.#dimension = embedding.length;
    return embedding;
  }
}
