import { TransformersJSEmbeddingModel } from '@browser-ai/transformers-js';
import { l2Normalize } from '../utils/similarity.js';

export interface EmbeddingGenerator {
  dimension: number;

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
export const DEFAULT_EMBEDDING_RUNTIME: EmbeddingRuntime = {
  provider: 'none',
  device: 'cpu',
  dtype: 'fp32',
};

export const DEFAULT_EMBEDDING_MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
export const DEFAULT_EMBEDDING_DIMENSION = 384;

export class TransformersEmbeddingGenerator implements EmbeddingGenerator {
  readonly dimension: number;
  private model: TransformersJSEmbeddingModel | null = null;

  constructor(
    private readonly runtime: EmbeddingRuntimeSource,
    modelId: string = DEFAULT_EMBEDDING_MODEL_ID,
    dimension: number = DEFAULT_EMBEDDING_DIMENSION
  ) {
    this.#modelId = modelId;
    this.dimension = dimension;
  }

  readonly #modelId: string;

  async generate(text: string): Promise<number[]> {
    if (!this.model) {
      // Embeddings ride the same settings rails (device/dtype/cacheDir) as chat models.
      const settings = this.runtime();
      this.model = new TransformersJSEmbeddingModel(this.#modelId, {
        device: settings.device,
        dtype: settings.dtype ?? (settings.quantized ? 'q4' : 'fp32'),
        ...(settings.cacheDir ? { cacheDir: settings.cacheDir } : {}),
        normalize: true,
        pooling: 'mean',
      } as never);
    }

    const result = await this.model.doEmbed({ values: [text] });
    return result.embeddings[0] ?? [];
  }
}

export class MockEmbeddingGenerator implements EmbeddingGenerator {
  constructor(readonly dimension: number = DEFAULT_EMBEDDING_DIMENSION) {}

  async generate(text: string): Promise<number[]> {
    const embedding = new Array(this.dimension).fill(0);
    for (let i = 0; i < text.length; i++) {
      embedding[i % this.dimension] += text.charCodeAt(i) / 256;
    }
    return l2Normalize(embedding);
  }
}

/**
 * Transformers (`MiniLM`) is the only real embedder and only ships with the
 * transformers provider; any other posture (llamacpp-embedded, ollama, mock)
 * degrades honestly to the deterministic generator rather than dragging a
 * second heavy runtime into the process (onnxruntime crashes under vitest
 * worker pools and cold loads cost minutes).
 */
export const isMockLM = (runtime: EmbeddingRuntimeSource): boolean =>
  runtime().provider !== 'transformers';

export function createEmbeddingGenerator(
  runtime: EmbeddingRuntimeSource = () => DEFAULT_EMBEDDING_RUNTIME,
  config?: Partial<EmbeddingGeneratorConfig> & { useMock?: boolean }
): EmbeddingGenerator {
  const { useMock = isMockLM(runtime), ...generatorConfig } = config ?? {};
  if (useMock) {
    return new MockEmbeddingGenerator(generatorConfig.dimension ?? DEFAULT_EMBEDDING_DIMENSION);
  }
  return new TransformersEmbeddingGenerator(
    runtime,
    generatorConfig.modelId,
    generatorConfig.dimension
  );
}

export { cosine as cosineSimilarity } from '../utils/similarity.js';