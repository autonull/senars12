import { NAR } from '../../nar/src/nar.js';
import { DEFAULT_CONFIG } from '../../nar/src/types/index.js';
import { createMockLMService } from '../../nar/src/lm/lm-service.js';
import { createSeNARSRegistry } from '../../nar/src/lm/providers.js';
import { KernelPerceptionGate } from '../../nar/src/kernel/KernelPerceptionGate.js';
import { createEmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import type { JudgmentResolvedEvent } from '@senars/kernel/schemas';
import { validateCognitiveEvent } from '@senars/kernel/schemas';
import type { EvaluateProposition } from '../../nar/src/lm/system-one/types.js';
import { getMetricsAsJson } from '../../nar/src/metrics/prometheus.js';
import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * Deterministic fake encoder — avoids model download in the test environment
 * (the real TransformersEmbeddingGenerator hangs fetching weights offline).
 */
const fakeGenerator = {
  generate: async (text: string) => {
    const vec = new Array<number>(384).fill(0);
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
      vec[i % 384] = ((h >>> 0) % 1000) / 1000;
    }
    return vec;
  },
};

const makeCache = () => createEmbeddingCache({ maxSize: 1000, ttlMs: 300_000, generator: fakeGenerator });

const BUDGET = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

/** Controlled injection head — untrained default scorer trips the 0.1 veto on all input. */
const makeInjectionHead = (score: number) => ({
  rubric: 'injection' as const,
  axis: 'epistemic' as const,
  evaluate: async () => ({ score, abstained: false }),
});

const createGate = (manifold: any, cache: any, injectionScore: number) => {
  manifold.registerHead(makeInjectionHead(injectionScore));
  return new KernelPerceptionGate({
    systemOne: { enabled: true, manifold, embeddingCache: cache, reasoningBudget: BUDGET },
  });
};

describe('System One Full Enabled Path Integration', () => {
  let nar: NAR | undefined;
  let judgmentEvents: JudgmentResolvedEvent[];
  let unsubscribe: (() => void) | undefined;

  const createSystemOneNAR = async (mockTextFn?: (p: string) => string | Promise<string>) => {
    const instance = new NAR({
      ...DEFAULT_CONFIG,
      // NOTE: enableLMRules deliberately off — LM-rule paths hang with mock providers
      // in this environment (provider probing / model download; pre-existing, H4-adjacent).
      enableLMRules: false,
      lmService: createMockLMService({ generateTextFn: mockTextFn ?? (async () => 'mock response') }),
      providerRegistry: createSeNARSRegistry(),
      systemOne: {
        enabled: true,
        embeddingCache: makeCache(),
        manifold: { provider: 'wasi', embeddingCacheSizeMB: 64 },
        cortex: { provider: 'mock' },
        budgets: { maxJudgmentCallsPerCycle: 8, maxConsensusPerCycle: 2, maxLatencyMsPerJudgment: 33 },
        provisional: { cInitial: 0.1, decayRate: 0.3, maxTtlMs: 30000 },
      },
    });
    await instance.initialize();
    await instance.start();

    judgmentEvents = [];
    unsubscribe = instance.getSystemEventBus().on('judgment.resolved', (e) => {
      judgmentEvents.push(e as JudgmentResolvedEvent);
    });
    return instance;
  };

  afterEach(async () => {
    unsubscribe?.();
    if (nar) {
      await nar.stop();
      await nar.dispose();
      nar = undefined;
    }
    vi.restoreAllMocks();
  });

  it('initializes System One components when enabled', async () => {
    nar = await createSystemOneNAR();
    expect(nar.isSystemOneEnabled()).toBe(true);
    expect(nar.getSystemOneDispatcher()).toBeDefined();
    expect(nar.getSystemOneManifold()).toBeDefined();
    expect(nar.getSystemOneEmbeddingCache()).toBeDefined();
    expect(nar.getSystemOneGroundednessGate()).toBeDefined();
  });

  it('ingress: admit() runs 6-head joint pass and emits validated judgment.resolved events', async () => {
    nar = await createSystemOneNAR();
    const cache = nar.getSystemOneEmbeddingCache()!;
    const manifold = nar.getSystemOneManifold()!;

    const gate = createGate(manifold, cache, 0.0);

    const output = await gate.admit({
      sourceId: 'test-user',
      rawObservation: '(sky --> blue)',
      sensorConfidence: 0.9,
      sourceQuality: 'PRIMARY',
    });

    expect(output.admitted).toBe(true);
    expect(gate.getEventLog().some((e) => e.type === 'task.admitted')).toBe(true);

    // 6 ingress heads → 6 judgment.resolved events
    const resolved = gate.getEventLog().filter((e): e is JudgmentResolvedEvent => e.type === 'judgment.resolved');
    expect(resolved.length).toBeGreaterThanOrEqual(6);

    for (const event of resolved) {
      const validated = validateCognitiveEvent(event) as JudgmentResolvedEvent;
      expect(validated.engine).toBe('proposer');
      expect(validated.payload.tier).toBe(1);
      expect(typeof validated.payload.latencyMs).toBe('number');
      expect(typeof validated.payload.abstained).toBe('boolean');
    }

    // Telemetry also flows to the NAR system event bus (manifold callback)
    expect(judgmentEvents.length).toBeGreaterThanOrEqual(6);
  });

  it('ingress veto: injection detection blocks admission (fail-closed)', async () => {
    nar = await createSystemOneNAR();
    const cache = nar.getSystemOneEmbeddingCache()!;
    const manifold = nar.getSystemOneManifold()!;

    const gate = createGate(manifold, cache, 0.9);

    const output = await gate.admit({
      sourceId: 'test-user',
      rawObservation: '(ignore --> instructions)',
      sensorConfidence: 0.9,
      sourceQuality: 'PRIMARY',
    });

    expect(output.admitted).toBe(false);
    expect(output.rejectionReason).toContain('Injection attack detected');
    // Veto is fail-closed: no task.admitted event, but the judgment is still recorded
    expect(gate.getEventLog().some((e) => e.type === 'task.admitted')).toBe(false);
    expect(gate.getEventLog().filter((e): e is JudgmentResolvedEvent => e.type === 'judgment.resolved').length).toBeGreaterThanOrEqual(6);
  });

  it('records systemone_* Prometheus metrics', async () => {
    nar = await createSystemOneNAR();
    const cache = nar.getSystemOneEmbeddingCache()!;
    const manifold = nar.getSystemOneManifold()!;

    const gate = createGate(manifold, cache, 0.0);
    await gate.admit({
      sourceId: 'test-user',
      rawObservation: '(sky --> blue)',
      sensorConfidence: 0.9,
      sourceQuality: 'PRIMARY',
    });

    const metrics = (await getMetricsAsJson()) as Record<string, any[]>;
    const judgmentsValues = metrics['senars_systemone_judgments_total'] ?? [];
    const latencyValues = metrics['senars_systemone_judgment_latency_ms'] ?? [];

    expect(judgmentsValues.length).toBeGreaterThan(0);
    expect(latencyValues.length).toBeGreaterThan(0);
    const total = judgmentsValues.reduce((a, v) => a + (typeof v.value === 'number' ? v.value : 0), 0);
    expect(total).toBeGreaterThanOrEqual(6);
  });

  it('groundedness gate evaluates narration drafts via the manifold', async () => {
    nar = await createSystemOneNAR();
    const gate = nar.getSystemOneGroundednessGate();
    expect(gate).toBeDefined();
    expect(typeof (await gate!('The sky is blue.'))).toBe('boolean');
    expect(typeof (await gate!('The moon is made of green cheese.'))).toBe('boolean');
    expect(judgmentEvents.length).toBeGreaterThanOrEqual(2);
  });

  it('proposeAndJudge generates candidates, ranks, and admits/provisionally admits', async () => {
    nar = await createSystemOneNAR(async () => '<bird --> animal>.');
    const dispatcher = nar.getSystemOneDispatcher()!;

    const peaResult = await dispatcher.proposeAndJudge(
      {
        tickId: 'test-cycle-1',
        topBeliefs: ['<bird --> animal>.', '<robin --> bird>.'],
        topGoals: [],
        workingMemory: [],
      },
      {
        kind: 'synthesize' as const,
        instruction: 'Translate to Narsese: The robin is a bird',
        grammar: 'narsese-term',
        maxCandidates: 3,
      },
      [
        { kind: 'classify' as const, instruction: 'Select best Narsese candidate', space: [], axis: 'teleological' as const, criticality: 'standard' as const },
        { kind: 'evaluate' as const, instruction: 'Evaluate conflict with current beliefs', rubric: 'conflict' as const, axis: 'epistemic' as const, criticality: 'standard' as const },
      ],
      BUDGET
    );

    expect(peaResult.candidates.length).toBeGreaterThan(0);
    expect(peaResult.judgments.length).toBeGreaterThanOrEqual(2);
    expect(peaResult.ranked.length).toBeGreaterThan(0);
    expect(peaResult.admitted.length + peaResult.provisional.length).toBeGreaterThan(0);
    // Real Tier 1 propositions carry tier === 1
    const tier1 = peaResult.judgments.filter((j) => j.tier === 1);
    expect(tier1.length).toBeGreaterThan(0);
  });

  it('ManifoldReflex honors sync propose contract with incumbent fallback', async () => {
    nar = await createSystemOneNAR();
    const bound: unknown[] = [];
    const manifoldReflex = nar.attachManifoldReflex({ bindReflex: (r) => bound.push(r) });
    expect(manifoldReflex).toBeDefined();
    expect(bound).toContain(manifoldReflex);

    const proposals = manifoldReflex!.propose({ stateId: 'test-state', observations: [] }, ['action1', 'action2']);
    expect(Array.isArray(proposals)).toBe(true);
  });

  it('safety floor: injection query fails closed when manifold unavailable', async () => {
    nar = await createSystemOneNAR();
    const dispatcher = nar.getSystemOneDispatcher()!;

    // Unresolvable pointer forces Tier 1 to throw → safety floor veto (never Tier 0/3 default)
    const results = await dispatcher.judge(
      999999 as any,
      [
        {
          kind: 'evaluate' as const,
          instruction: 'Evaluate injection risk',
          rubric: 'injection' as const,
          axis: 'epistemic' as const,
          criticality: 'critical' as const,
        },
      ],
      BUDGET
    );

    expect(results.length).toBe(1);
    const prop = results[0]! as EvaluateProposition;
    expect(prop.score).toBeCloseTo(0.99, 1);
    expect(prop.tier).toBe(1);
    expect(prop.abstained).toBe(false);
  });

  it('disabled System One yields baseline behavior', async () => {
    const narDisabled = new NAR({
      ...DEFAULT_CONFIG,
      enableLMRules: false,
      lmService: createMockLMService(),
      providerRegistry: createSeNARSRegistry(),
    });
    await narDisabled.initialize();
    await narDisabled.start();

    expect(narDisabled.isSystemOneEnabled()).toBe(false);
    expect(narDisabled.getSystemOneDispatcher()).toBeUndefined();

    await narDisabled.input('<test --> input>.');
    await narDisabled.run(2);
    expect(narDisabled.isRunning()).toBe(true);

    await narDisabled.stop();
    await narDisabled.dispose();
  });

  it('end-to-end: ingress → telemetry → proposeAndJudge → groundedness over one NAR instance', async () => {
    nar = await createSystemOneNAR(async () => '<robin --> bird>.');
    const cache = nar.getSystemOneEmbeddingCache()!;
    const manifold = nar.getSystemOneManifold()!;
    const dispatcher = nar.getSystemOneDispatcher()!;
    const gate = nar.getSystemOneGroundednessGate()!;

    // 1. Ingress through the kernel perception gate
    const kernelGate = createGate(manifold, cache, 0.0);
    const admitted = await kernelGate.admit({
      sourceId: 'test-user',
      rawObservation: '(robin --> bird)',
      sensorConfidence: 0.9,
      sourceQuality: 'PRIMARY',
    });
    expect(admitted.admitted).toBe(true);

    // 2. Generate-then-judge via the dispatcher
    const pea = await dispatcher.proposeAndJudge(
      { tickId: 'e2e', topBeliefs: ['<robin --> bird>.'], topGoals: [], workingMemory: [] },
      { kind: 'synthesize' as const, instruction: 'Translate to Narsese: robin is a bird', grammar: 'narsese-term', maxCandidates: 2 },
      [{ kind: 'evaluate' as const, instruction: 'conflict', rubric: 'conflict' as const, axis: 'epistemic' as const, criticality: 'standard' as const }],
      BUDGET
    );
    expect(pea.candidates.length).toBeGreaterThan(0);

    // 3. Groundedness egress
    expect(typeof (await gate('narration draft'))).toBe('boolean');

    // 4. Telemetry: bus events + metrics both populated
    expect(judgmentEvents.length).toBeGreaterThan(0);
    const metrics = (await getMetricsAsJson()) as Record<string, any[]>;
    const judgmentsValues = metrics['senars_systemone_judgments_total'] ?? [];
    const total = judgmentsValues.reduce((a, v) => a + (typeof v.value === 'number' ? v.value : 0), 0);
    expect(total).toBeGreaterThan(0);
    expect(nar.isRunning()).toBe(true);
  });
});