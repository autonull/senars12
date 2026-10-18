/**
 * CORE.19 — the real, offline embedding path (no mock) and the width-agnostic cache.
 *
 * The embedded llama.cpp provider now has a real generator: `resolveEmbeddingGenerator`
 * returns a `LlamaCppEmbeddingGenerator` over the configured GGUF, and the embedding
 * cache allocates to the vector it receives rather than assuming 384. The model-backed
 * cases run only when a GGUF is present (`.models/` is gitignored, so CI skips them);
 * the cache cases run always.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveEmbeddingGenerator } from '../../nar/src/lm/embedding-runtime.js';
import { createEmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { MockEmbeddingGenerator } from '../../nar/src/memory/embedding.js';

const MODEL =
  process.env.LM_LLAMACPP_MODEL ?? join(process.cwd(), '.models', 'Qwen3.5-0.8B-Q4_0.gguf');
const hasModel = existsSync(MODEL);

const cosine = (x: readonly number[], y: readonly number[]): number => {
  let dot = 0;
  let nx = 0;
  let ny = 0;
  for (let i = 0; i < x.length; i++) {
    dot += x[i]! * y[i]!;
    nx += x[i]! ** 2;
    ny += y[i]! ** 2;
  }
  return dot / (Math.sqrt(nx) * Math.sqrt(ny));
};

describe('embedding cache — width-agnostic pooling (no 384 assumption)', () => {
  it('allocates to the generator width', async () => {
    const cache = createEmbeddingCache({ generator: new MockEmbeddingGenerator(1024) });
    const pointer = await cache.write('hello');
    expect(cache.read(pointer)?.length).toBe(1024);
  });

  it('reuses a released buffer only at its own width', async () => {
    const cache = createEmbeddingCache({ generator: new MockEmbeddingGenerator(8), maxSize: 2 });
    const first = await cache.write('one');
    await cache.write('two');
    await cache.write('three'); // evicts 'one', releasing its 8-wide slot
    expect(cache.read(first)).toBeUndefined();
    expect(cache.read(await cache.write('four'))?.length).toBe(8);
  });

  it('still rejects a wrong width when a width is declared', async () => {
    const cache = createEmbeddingCache({ dimension: 7, generator: new MockEmbeddingGenerator(7) });
    const bad = { dimension: 7, generate: async () => [0.1, 0.2, 0.3] };
    await expect(createEmbeddingCache({ dimension: 7, generator: bad }).write('x')).rejects.toThrow(
      /dimension mismatch/
    );
    await expect(cache.write('x')).resolves.toBeTypeOf('number');
  });
});

describe.skipIf(!hasModel)('LlamaCppEmbeddingGenerator — real, offline embeddings', () => {
  const previous = process.env.LM_LLAMACPP_MODEL;
  beforeAll(() => {
    process.env.LM_LLAMACPP_MODEL = MODEL;
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.LM_LLAMACPP_MODEL;
    else process.env.LM_LLAMACPP_MODEL = previous;
  });

  it('embeds with the configured GGUF (no mock), deterministically and on-topic', async () => {
    // The runtime source forces the provider; the path comes from settings (env).
    const generator = resolveEmbeddingGenerator(() => ({
      provider: 'llamacpp-embedded',
      device: 'cpu',
    }));
    expect(generator.modelId).toMatch(/\.gguf$/);

    const cat = await generator.generate('the cat sat on the mat');
    const again = await generator.generate('the cat sat on the mat');
    const physics = await generator.generate('quantum chromodynamics is a gauge theory');

    expect(cat.length).toBeGreaterThan(0);
    expect(cat).toEqual(again); // deterministic — same text, same vector
    expect(generator.dimension).toBe(cat.length);
    // Real semantics: a paraphrase is nearer than an unrelated sentence (no mock).
    expect(cosine(cat, await generator.generate('a feline rested on the rug'))).toBeGreaterThan(
      cosine(cat, physics)
    );
  }, 120_000);
});
