import { TransformersJSEmbeddingModel } from '@browser-ai/transformers-js';
import { detectDevice, getLMSettings } from '../lm/providers.js';

export interface EmbeddingGenerator {
  dimension: number;

  generate(text: string): Promise<number[]>;
}

export interface EmbeddingGeneratorConfig {
  modelId: string;
  dimension: number;
}

export const DEFAULT_EMBEDDING_MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
export const DEFAULT_EMBEDDING_DIMENSION = 384;

export class TransformersEmbeddingGenerator implements EmbeddingGenerator {
  readonly dimension: number;
  private model: TransformersJSEmbeddingModel | null = null;

  constructor(modelId: string = DEFAULT_EMBEDDING_MODEL_ID, dimension: number = DEFAULT_EMBEDDING_DIMENSION) {
    this.#modelId = modelId;
    this.dimension = dimension;
  }

  readonly #modelId: string;

  async generate(text: string): Promise<number[]> {
    if (!this.model) {
      // Embeddings ride the same LM settings rails (device/dtype/cacheDir) as chat models.
      const settings = getLMSettings();
      this.model = new TransformersJSEmbeddingModel(this.#modelId, {
        device: detectDevice(),
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
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map((v) => v / norm);
  }
}

export function createEmbeddingGenerator(useMock = false, config?: Partial<EmbeddingGeneratorConfig>): EmbeddingGenerator {
  if (useMock) return new MockEmbeddingGenerator(config?.dimension ?? DEFAULT_EMBEDDING_DIMENSION);
  return new TransformersEmbeddingGenerator(config?.modelId, config?.dimension);
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
