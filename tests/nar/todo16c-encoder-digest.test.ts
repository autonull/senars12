import { describe, expect, it } from 'vitest';
import {
  composeModelDigest,
  DigestMismatchError,
  encoderDigest,
  loadHeadRuntime,
  verifyModelDigest,
} from '../../nar/src/lm/system-one/wasi-runtime.js';
import {
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL_ID,
  MockEmbeddingGenerator,
  TransformersEmbeddingGenerator,
  createEmbeddingGenerator,
  type EmbeddingGenerator,
} from '../../nar/src/memory/embedding.js';
import { createEmbeddingCache, type EmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { appConfigSchema, systemOneSchema } from '../../src/config/schema.js';

const passThroughManifold = () => ({
  judgeBatch: async () => [],
  consensus: async () => ({ proposition: {} as never, agreement: 1, independent: true }),
  health: () => ({} as never),
});

describe('Bench 26 — Encoder Digest Binding', () => {
  it('encoder config defaults to MiniLM/384 and parses custom values', async () => {
    const defaults = systemOneSchema.parse({}) as { manifold: { encoder: { modelId: string; dimension: number } } };
    expect(defaults.manifold.encoder).toEqual({ modelId: DEFAULT_EMBEDDING_MODEL_ID, dimension: DEFAULT_EMBEDDING_DIMENSION });
    const custom = (await appConfigSchema.parseAsync({
      systemOne: { enabled: true, manifold: { encoder: { modelId: 'Xenova/all-mpnet-base-v2', dimension: 768 } } },
    })) as { systemOne?: { manifold: { encoder: { modelId: string; dimension: number } } } };
    expect(custom.systemOne?.manifold.encoder).toEqual({ modelId: 'Xenova/all-mpnet-base-v2', dimension: 768 });
  });

  it('composeModelDigest binds encoder identity to head weights — encoder swap changes the digest', () => {
    const enc = encoderDigest(DEFAULT_EMBEDDING_MODEL_ID, 384);
    const d1 = composeModelDigest(enc, 'head-weights-v1');
    const d2 = composeModelDigest(encoderDigest('Xenova/all-mpnet-base-v2', 768), 'head-weights-v1');
    const d3 = composeModelDigest(enc, 'head-weights-v2');
    expect(d1).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(d1).not.toBe(d2);
    expect(d1).not.toBe(d3);
    expect(composeModelDigest(enc, 'head-weights-v1')).toBe(d1);
  });

  it('digest mismatch fails closed (no demotion ladder)', () => {
    expect(() => verifyModelDigest('sha256:' + 'a'.repeat(64), 'sha256:' + 'b'.repeat(64))).toThrow(DigestMismatchError);
    const ok = composeModelDigest(encoderDigest(DEFAULT_EMBEDDING_MODEL_ID, 384), 'w');
    expect(() => loadHeadRuntime(passThroughManifold() as never, { provider: 'off', modelDigest: ok }, ok)).not.toThrow();
    expect(() => loadHeadRuntime(passThroughManifold() as never, { provider: 'off', modelDigest: ok }, 'sha256:' + 'c'.repeat(64))).toThrow(DigestMismatchError);
  });

  it('EmbeddingCache rejects wrong-dimension vectors at the boundary', async () => {
    const generator: EmbeddingGenerator = {
      dimension: 7,
      generate: async () => [0.1, 0.2, 0.3], // wrong width
    };
    const cache = createEmbeddingCache({ dimension: 7, generator });
    await expect(cache.write('x')).rejects.toThrow(/dimension mismatch/);
  });

  it('EmbeddingCache accepts the configured generator and passes its model id through', async () => {
    const generator = new MockEmbeddingGenerator(8);
    const cache = createEmbeddingCache({ dimension: 8, generator });
    await expect(cache.write('hello')).resolves.toBeTypeOf('number');
    await expect(cache.write('hello again')).resolves.toBeTypeOf('number');
  });

  it('createEmbeddingGenerator parameterizes model id + dimension', () => {
    const custom = createEmbeddingGenerator(false, { modelId: 'Xenova/all-mpnet-base-v2', dimension: 768 });
    expect(custom).toBeInstanceOf(TransformersEmbeddingGenerator);
    expect(custom.dimension).toBe(768);
    const mock = createEmbeddingGenerator(true, { dimension: 16 });
    expect(mock).toBeInstanceOf(MockEmbeddingGenerator);
    expect(mock.dimension).toBe(16);
  });
});
