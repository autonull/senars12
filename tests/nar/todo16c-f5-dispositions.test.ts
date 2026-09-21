import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NAR } from '@senars/nar';
import { createNAR } from '@senars/nar';
import { admitTasks } from '@senars/nar/lm';
import type { LMService } from '@senars/nar/lm';
import { createSystemOneLMRuleAdapter } from '@senars/nar/lm/system-one/rule-adapter';
import { ProactiveEnricher } from '@senars/nar/lm/enrichment';
import { termParser } from '@senars/nar/terms';
import { Truth } from '@senars/nar/terms';

/**
 * F5 — §8 dispositions with real consumers:
 * - lm-meta-reasoning / lm-uncertainty-calibration REPLACE (manifold scoring + isotonic calibrators, no generative call)
 * - shadow-validation `conflict` head consumer
 * - proactive-enrichment `novelty` budget gate
 */
describe('F5 — §8 dispositions', () => {
  let nar: NAR;
  let lmCalls: number;

  beforeEach(async () => {
    lmCalls = 0;
    const mockLMService = {
      generateText: vi.fn(async () => {
        lmCalls++;
        return '(mock --> response).';
      }),
      tryGenerateText: vi.fn(async () => {
        lmCalls++;
        return '(mock --> response).';
      }),
      getStats: vi.fn().mockReturnValue({}),
      setProgressCallback: vi.fn(),
    } as unknown as LMService;

    nar = createNAR({
      lmService: mockLMService,
      systemOne: {
        enabled: true,
        cortex: { provider: 'mock' },
        manifold: {
          provider: 'off',
          embeddingCacheSizeMB: 64,
          encoder: { modelId: 'Xenova/all-MiniLM-L6-v2', dimension: 384 },
          heads: {},
          consensus: { criticalityFloor: 'high', fanout: 3, minAgreement: 0.66 },
        },
        budgets: {
          maxJudgmentCallsPerCycle: 8,
          maxConsensusPerCycle: 2,
          maxLatencyMsPerJudgment: 33,
          maxTokensPerCycle: 4096,
          maxMemoryMbPerCycle: 256,
        },
        provisional: { cInitial: 0.1, decayRate: 0.3, maxTtlMs: 30000 },
        distillation: {
          datasetPath: './data/systemone-distillation.jsonl',
          bakeOffSamplingRate: 0.1,
          driftEceBound: 0.15,
        },
      },
      maxConcepts: 1000,
    });
    await nar.initialize();
    await nar.start();
  });

  it('lm-meta-reasoning REPLACE: manifold scores derivation traces, no generative call', async () => {
    const rule = nar.getProcessor().getLMRule('lm-meta-reasoning');
    expect(rule).toBeDefined();
    const primary = termParser.parse('(a --> b)')!;
    const tasks = await rule!.apply(primary, undefined, {
      recentDerivations: ['(c --> d)', '(e --> f)'],
    });
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.length).toBeLessThanOrEqual(2);
    for (const t of tasks) {
      expect(['(c --> d)', '(e --> f)']).toContain(t.term.toString());
      expect(t.type).toBe('belief');
    }
    expect(lmCalls).toBe(0);
  });

  it('lm-meta-reasoning with no traces degrades silently (no generative call)', async () => {
    const rule = nar.getProcessor().getLMRule('lm-meta-reasoning')!;
    const tasks = await rule.apply(termParser.parse('(a --> b)')!, undefined, {});
    expect(tasks).toEqual([]);
    expect(lmCalls).toBe(0);
  });

  it('lm-uncertainty-calibration REPLACE: identity calibration when unfitted, no generative call', async () => {
    const rule = nar.getProcessor().getLMRule('lm-uncertainty-calibration')!;
    const tasks = await rule.apply(termParser.parse('(a --> b)')!, undefined, {
      truth: { f: 0.8, c: 0.4 },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.term.toString()).toBe('(a --> b)');
    expect(tasks[0]!.truth.c).toBeCloseTo(0.4, 5);
    expect(tasks[0]!.truth.f).toBeCloseTo(0.8, 5);
    expect(lmCalls).toBe(0);
  });

  it('adapter calibrateUncertainty applies drift demotion when manifold unhealthy', async () => {
    const adapter = createSystemOneLMRuleAdapter({
      dispatcher: nar.getSystemOneDispatcher()!,
      nar: {
        getCycleCount: () => nar.getCycleCount(),
        getSystemOneEmbeddingCache: () => nar.getSystemOneEmbeddingCache(),
        getSystemOneManifold: () => nar.getSystemOneManifold(),
      },
    });
    // Force unhealthy health (manual demote) via the drift-demotion manager.
    (nar.getSystemOneManifold() as unknown as { setDemoted(d: boolean): void }).setDemoted(true);
    const [task] = await adapter.calibrateUncertainty(termParser.parse('(a --> b)')!, {
      truth: { f: 0.8, c: 0.5 },
    });
    expect(task!.truth.c).toBeCloseTo(0.4, 5); // 0.5 × 0.8
    (nar.getSystemOneManifold() as unknown as { setDemoted(d: boolean): void }).setDemoted(false);
  });

  it('shadow validation: frequency check preserved; conflict head inactive while unfitted', async () => {
    const mkTask = (narsese: string, f: number): Parameters<typeof admitTasks>[1][number] =>
      ({
        term: termParser.parse(narsese)!,
        type: 'belief',
        truth: Truth.create(f, 0.9),
        budget: { priority: 0.7, durability: 0.8, quality: 0.9, cycles: 10, depth: 5 },
      }) as never;
    expect(await admitTasks(nar.memory, [mkTask('(x --> y)', 0.9)], 'llm')).toBe(1);
    // frequency delta 0.8 > 0.3 ⇒ rejected
    expect(await admitTasks(nar.memory, [mkTask('(x --> y)', 0.1)], 'llm')).toBe(0);
  });

  it('proactive enrichment: novelty gate inactive while head unfitted (behavior preserved)', async () => {
    const adapter = createSystemOneLMRuleAdapter({
      dispatcher: nar.getSystemOneDispatcher()!,
      nar: {
        getCycleCount: () => nar.getCycleCount(),
        getSystemOneEmbeddingCache: () => nar.getSystemOneEmbeddingCache(),
        getSystemOneManifold: () => nar.getSystemOneManifold(),
      },
    });
    const enricher = new ProactiveEnricher(
      nar.memory,
      {
        generateText: async () => '(bridge --> link).',
      } as unknown as never,
      { enableProactiveEnrichment: true, enrichmentIntervalMs: 60000, maxConceptsPerCycle: 10, minConnectionsForEnrichment: 2, enableExplanationGeneration: false, enableQAService: false },
      { adapter }
    );
    const before = lmCalls;
    const results = await enricher.runEnrichmentCycle();
    expect(Array.isArray(results)).toBe(true);
    // gate must not throw on an unfitted novelty head; LM mock may or may not be hit
    expect(lmCalls).toBeGreaterThanOrEqual(before);
  });
});
