import { EmbeddingCache } from '@senars/nar/lm/system-one/embedding-cache.js';
import {
  canonicalState,
  createOpenSystemOneManifold,
} from '@senars/nar/lm/system-one/open-systemone-manifold.js';
import { seedTruth } from '@senars/nar/lm/system-one/seed.js';
import type { JudgmentQuery, ReasoningBudget } from '@senars/nar/lm/system-one/types.js';
import { describe, expect, it } from 'vitest';

const budget: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

/** CI fixture replica speaking the community `{state, questions}` contract. */
const fixtureFetch: typeof fetch = async (_url, init) => {
  const request = JSON.parse(String(init?.body)) as {
    state: string;
    questions: Array<{ id: string; type: string; options?: string[] }>;
  };
  expect(typeof request.state).toBe('string');
  const answers = request.questions.map((q) => {
    if (q.type === 'choice' && q.options) {
      const p = 1 / q.options.length;
      return {
        id: q.id,
        choice: q.options[0],
        distribution: q.options.map((option) => ({ option, p })),
      };
    }
    if (q.type === 'boolean') return { id: q.id, boolean: true };
    return { id: q.id, score: 0.75 };
  });
  return new Response(JSON.stringify({ model: 'kev:1.0', answers }), { status: 200 });
};

const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });

const manifoldWith = (fetchImpl: typeof fetch) =>
  createOpenSystemOneManifold({
    endpoint: 'http://fixture/v1',
    embeddingCache: cache,
    fetchImpl,
  });

describe('TODO17 Bench 33 — Open one-pass wire bridge', () => {
  it('classify → Choice → top + distribution (round-trip)', async () => {
    await cache.warmup(['state']);
    const pointer = await cache.write('state');
    const manifold = manifoldWith(fixtureFetch);
    const query: JudgmentQuery = {
      kind: 'classify',
      instruction: 'pick action',
      space: ['up', 'down'],
      axis: 'teleological',
    };
    const [p] = await manifold.judgeBatch(pointer, [query], budget);
    expect(p?.kind).toBe('classify');
    expect(p?.abstained).toBe(false);
    const dist = (p as unknown as { distribution: Array<{ option: string; p: number }> }).distribution;
    expect(dist.map((d) => d.option).sort()).toEqual(['down', 'up']);
    expect((p as unknown as { top: { option: string } }).top.option).toBe('up');
  });

  it('evaluate → Score; levels → choice legend; boolean anchor → 0/1 score', async () => {
    await cache.warmup(['state']);
    const pointer = await cache.write('state');
    const manifold = manifoldWith(fixtureFetch);
    const [scored, leveled, bool] = await manifold.judgeBatch(
      pointer,
      [
        { kind: 'evaluate', instruction: 'value', rubric: 'reflex_value', axis: 'teleological' },
        { kind: 'evaluate', instruction: 'value', rubric: 'risk', axis: 'teleological', levels: ['low', 'high'] },
        { kind: 'evaluate', instruction: 'safe?', rubric: 'feasibility', axis: 'teleological' },
      ],
      budget
    );
    expect(scored?.kind).toBe('evaluate');
    expect((scored as unknown as { score: number }).score).toBe(0.75);
    expect(leveled?.kind).toBe('evaluate');
    expect((leveled as unknown as { score: number }).score).toBe(0.75);
    expect((bool as unknown as { score: number }).score).toBe(1);
  });

  it('boolean answers map to 0/1 evaluate scores', async () => {
    await cache.warmup(['state']);
    const pointer = await cache.write('state');
    const boolFetch: typeof fetch = async (_url, init) => {
      const request = JSON.parse(String(init?.body)) as { questions: Array<{ id: string }> };
      return new Response(
        JSON.stringify({ model: 'kev:1.0', answers: request.questions.map((q) => ({ id: q.id, boolean: true })) }),
        { status: 200 }
      );
    };
    const [p] = await manifoldWith(boolFetch).judgeBatch(
      pointer,
      [{ kind: 'evaluate', instruction: 'feasible?', rubric: 'feasibility', axis: 'teleological' }],
      budget
    );
    expect((p as unknown as { score: number }).score).toBe(1);
  });

  it('provenance: cortexModelId carries the replica id', async () => {
    await cache.warmup(['state']);
    const pointer = await cache.write('state');
    const [p] = await manifoldWith(fixtureFetch).judgeBatch(
      pointer,
      [{ kind: 'evaluate', instruction: 'v', rubric: 'reflex_value', axis: 'teleological' }],
      budget
    );
    expect(String(p!.modelDigest)).toContain('kev');
    expect(String(p!.backendId)).toBe('open-systemone');
  });

  it('re-entry ceiling: seedTruth(LLM_PRIOR) caps confidence at 0.5', async () => {
    await cache.warmup(['state']);
    const pointer = await cache.write('state');
    const [p] = await manifoldWith(fixtureFetch).judgeBatch(
      pointer,
      [{ kind: 'classify', instruction: 'pick', space: ['a', 'b'], axis: 'teleological' }],
      budget
    );
    const truth = seedTruth(p!, 'LLM_PRIOR');
    expect(truth.c).toBeLessThanOrEqual(0.5);
  });

  it('malformed response ⇒ fail-closed (breaker, abstain)', async () => {
    await cache.warmup(['state']);
    const pointer = await cache.write('state');
    const badFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ answers: 'nonsense' }), { status: 200 });
    const manifold = manifoldWith(badFetch);
    await expect(
      manifold.judgeBatch(
        pointer,
        [{ kind: 'evaluate', instruction: 'v', rubric: 'reflex_value', axis: 'teleological' }],
        budget
      )
    ).rejects.toThrow();
    expect(manifold.health().breakerOpen).toBe(true);
  });

  it('missing answer ⇒ fail-closed abstention', async () => {
    await cache.warmup(['state']);
    const pointer = await cache.write('state');
    const emptyFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ model: 'kev:1.0', answers: [] }), { status: 200 });
    const [p] = await manifoldWith(emptyFetch).judgeBatch(
      pointer,
      [{ kind: 'evaluate', instruction: 'v', rubric: 'reflex_value', axis: 'teleological' }],
      budget
    );
    expect(p?.abstained).toBe(true);
  });

  it('canonical state is stable across identical embeddings', () => {
    const e = new Float32Array(384).fill(0.123456789);
    expect(canonicalState(e)).toBe(canonicalState(Float32Array.from(e)));
    expect(canonicalState(e).length).toBeLessThan(4000);
  });

  it('state serialization round-trips through the canonical form', () => {
    const e = new Float32Array([1.5, -2.25]);
    expect(JSON.parse(canonicalState(e))).toEqual([1.5, -2.25]);
  });
});

describe.skipIf(!process.env.OPEN_REPLICA_ENDPOINT)('live replica leg (env-gated)', () => {
  it('smoke: classify round-trip against the configured endpoint', async () => {
    await cache.warmup(['state']);
    const pointer = await cache.write('state');
    const manifold = createOpenSystemOneManifold({
      endpoint: process.env.OPEN_REPLICA_ENDPOINT!,
      embeddingCache: cache,
    });
    const [p] = await manifold.judgeBatch(
      pointer,
      [{ kind: 'classify', instruction: 'pick', space: ['up', 'down'], axis: 'teleological' }],
      budget
    );
    expect(p?.abstained).toBe(false);
    expect(manifold.health().breakerOpen).toBe(false);
  });
});
