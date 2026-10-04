import type { ReasoningBudget } from '@senars/core/schemas/reasoning-budget';
import { stableStringify } from '@senars/util';
import { describe, expect, it } from 'vitest';
import {
  createJudgmentDelegation,
  JudgmentDelegationPeer,
} from '../../nar/src/cooperation/delegation.js';
import { KernelBudgetGate } from '../../nar/src/kernel/KernelBudgetGate.js';
import { EmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import {
  admitRemotePropositions,
  handleSystemOneRequest,
} from '../../nar/src/lm/system-one/http-endpoint.js';
import {
  createManifold,
  createManifold as createTier1Manifold,
} from '../../nar/src/lm/system-one/manifold.js';
import { assertCostReported, chargeJudgment } from '../../nar/src/lm/system-one/resource-gate.js';
import type { EmbeddingPointer, JudgmentProposition } from '../../nar/src/lm/system-one/types.js';
import {
  DigestMismatchError,
  loadHeadRuntime,
  SandboxedHeadRuntime,
  verifyModelDigest,
} from '../../nar/src/lm/system-one/wasi-runtime.js';
import { prometheusRegistry, recordJudgmentMetric } from '../../nar/src/metrics/prometheus.js';

const budget: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

const makeProposition = (over: Partial<JudgmentProposition> = {}): JudgmentProposition =>
  ({
    kind: 'evaluate',
    axis: 'epistemic',
    score: 0.7,
    queryId: 'q1',
    backendId: 'encoder-wasm-s1',
    modelDigest: `sha256:${'a'.repeat(64)}`,
    calibration: { version: 'v2.4.1', ece: 0.02 },
    latencyMs: 5,
    cost: { tokensIn: 8, tokensOut: 0, computeMs: 5, memoryMb: 4 },
    tier: 1,
    abstained: false,
    ...over,
  }) as JudgmentProposition;

describe('System One — AIKR Resource Accounting (Bench 12)', () => {
  it('every manifold proposition reports a valid ResourceCost', async () => {
    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
    await cache.warmup(['ctx']);
    const manifold = createManifold(cache, { abstainThreshold: 0.05 });
    const pointer = await cache.write('resource accounting context');
    const results = await manifold.judgeBatch(
      pointer as EmbeddingPointer,
      [
        {
          kind: 'evaluate',
          instruction: 'Evaluate relevance',
          rubric: 'relevance',
          axis: 'epistemic',
        },
        { kind: 'classify', instruction: 'Classify task', space: ['a', 'b'], axis: 'epistemic' },
      ],
      budget
    );
    for (const p of results) expect(() => assertCostReported(p)).not.toThrow();
  });

  it('KernelBudgetGate grants judgments within budget', () => {
    const gate = new KernelBudgetGate();
    const verdict = chargeJudgment(gate, 'scope-grant', {
      tokensIn: 8,
      tokensOut: 0,
      computeMs: 5,
      memoryMb: 4,
    });
    expect(verdict.granted).toBe(true);
  });

  it('KernelBudgetGate denies judgments that exceed the budget', () => {
    const gate = new KernelBudgetGate();
    const exhausted = {
      tokensIn: 100_000,
      tokensOut: 100_000,
      computeMs: 50_000,
      memoryMb: 10_000,
    };
    for (let i = 0; i < 100; i++) {
      const verdict = chargeJudgment(gate, 'scope-deny', exhausted);
      if (!verdict.granted) {
        expect(verdict.terminationReason).toBeDefined();
        return;
      }
    }
    throw new Error('BudgetGate never denied an over-budget head');
  });

  it('judgment delegation round-trips and re-enters at PEER_AGENT quality', async () => {
    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
    await cache.warmup(['ctx']);
    const manifold = createManifold(cache, { abstainThreshold: 0.05 });
    const peer = new JudgmentDelegationPeer(manifold, budget, cache);
    const delegation = createJudgmentDelegation(
      [0.1, 0.2, 0.3],
      [
        {
          kind: 'evaluate',
          instruction: 'Evaluate relevance',
          rubric: 'relevance',
          axis: 'epistemic',
        },
      ],
      'ws://peer'
    );

    const result = await peer.executeJudgment(delegation);
    expect(result.success).toBe(true);
    expect(result.sourceQuality).toBe('PEER_AGENT');
    expect(result.propositions).toHaveLength(1);

    // PEER_AGENT ceiling is 0.6; abstained propositions carry no seeded truth
    const admitted = admitRemotePropositions(result.propositions, 'PEER_AGENT');
    for (const { proposition, truth } of admitted) {
      if (proposition.abstained) {
        expect(truth).toBeUndefined();
      } else {
        expect(truth!.c).toBeLessThanOrEqual(0.6);
      }
    }
  });

  it('untrusted HTTP results are seeded at the LLM_PRIOR ceiling (0.5)', async () => {
    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
    await cache.warmup(['ctx']);
    const manifold = createManifold(cache, { abstainThreshold: 0.05 });
    const response = await handleSystemOneRequest(
      {
        json: async () => ({
          contextEmbedding: [0.1, 0.2, 0.3],
          queries: [
            {
              kind: 'evaluate',
              instruction: 'Evaluate relevance',
              rubric: 'relevance',
              axis: 'epistemic',
            },
          ],
        }),
      },
      manifold,
      budget,
      async (ctx) => cache.writeRaw(ctx)
    );
    expect(response.status).toBe(200);
    const body = response.body as { propositions: JudgmentProposition[]; sourceQuality: string };
    expect(body.sourceQuality).toBe('LLM_PRIOR');
    const admitted = admitRemotePropositions(body.propositions, 'LLM_PRIOR');
    for (const { proposition, truth } of admitted) {
      if (proposition.abstained) expect(truth).toBeUndefined();
      else expect(truth!.c).toBeLessThanOrEqual(0.5);
    }

    // Malformed requests rejected
    const bad = await handleSystemOneRequest(
      { json: async () => ({ garbage: true }) },
      manifold,
      budget,
      async (ctx) => cache.writeRaw(ctx)
    );
    expect(bad.status).toBe(400);
  });

  it('hash-pinned runtime fails closed on digest mismatch', async () => {
    const pinned = `sha256:${'a'.repeat(64)}`;
    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
    await cache.warmup(['ctx']);
    const inner = createTier1Manifold(cache, { modelDigest: pinned as never });

    expect(() =>
      loadHeadRuntime(inner, { provider: 'wasi', modelDigest: pinned }, `sha256:${'b'.repeat(64)}`)
    ).toThrow(DigestMismatchError);
    expect(() =>
      loadHeadRuntime(inner, { provider: 'wasi', modelDigest: 'unpinned' }, pinned)
    ).toThrow(DigestMismatchError);

    const runtime = loadHeadRuntime(inner, { provider: 'wasi', modelDigest: pinned }, pinned);
    expect(runtime).toBeInstanceOf(SandboxedHeadRuntime);
  });

  it('verifyModelDigest enforces the pin format', () => {
    expect(() =>
      verifyModelDigest(`sha256:${'a'.repeat(64)}`, `sha256:${'a'.repeat(64)}`)
    ).not.toThrow();
    expect(() => verifyModelDigest('x', `sha256:${'a'.repeat(64)}`)).toThrow(DigestMismatchError);
    expect(() => verifyModelDigest(`sha256:${'a'.repeat(64)}`, 'not-a-sha')).toThrow(
      DigestMismatchError
    );
  });

  it('recordJudgmentMetric labels the judgment and stamps its latency', async () => {
    // The registry is process-global, so the reading is a delta: asserting an
    // absolute counter made this test fail whenever another file in the worker had
    // already recorded a judgment.
    const valueOf = async (
      name: string,
      labels: Record<string, string>
    ): Promise<number | undefined> => {
      const json = (await prometheusRegistry.getMetricsAsJSON()) as Array<{
        name: string;
        values: Array<{ labels: Record<string, string>; value: number }>;
      }>;
      return json
        .find((m) => m.name === name)
        ?.values.find((v) => stableStringify(v.labels) === stableStringify(labels))?.value;
    };

    const judgments = { axis: 'epistemic', shape: 'evaluate', tier: '1', abstained: 'false' };
    const latency = { tier: '1' };
    const before = [
      await valueOf('senars_systemone_judgments_total', judgments),
      await valueOf('senars_systemone_judgment_latency_ms', latency),
    ];

    recordJudgmentMetric('epistemic', 'evaluate', 1, false, 12);

    expect(await valueOf('senars_systemone_judgments_total', judgments)).toBe((before[0] ?? 0) + 1);
    expect(await valueOf('senars_systemone_judgment_latency_ms', latency)).toBe(
      (before[1] ?? 0) + 12
    );
  });
});
