/**
 * Bench 90 (REFACTOR.todo2 Phase E): strategy composition algebra, MeTTa
 * proposer + weighted-quorum consensus, per-key reputation granularity, and
 * the reputation-fed probe curriculum. C7: plain-name strategy configs stay
 * byte-identical; C1/C6: every new path is opt-in.
 */
import { Effect } from 'effect';
import { atom, createMinimalNAR, createTask, TermBuilder, Truth } from '@senars/nar';
import { DEFAULT_COGNITIVE_PARAMETERS } from '@senars/nar/config/cognitive-parameters';
import { selectProbes } from '@senars/nar/dialogue';
import { SystemOneIngressJudge } from '@senars/nar/lm/system-one/ingress-judge.js';
import { KernelPerceptionGate } from '@senars/nar/kernel/KernelPerceptionGate.js';
import { domainKey, providerKey } from '@senars/nar/kernel/reputation-keys.js';
import { SourceReputation } from '@senars/nar/kernel/source-reputation.js';
import { EmbeddingCache } from '@senars/nar/lm/system-one/embedding-cache';
import { RuleProcessor } from '@senars/nar/rules';
import { MettaProposer } from '@senars/nar/reflex';
import { Negotiator } from '@senars/nar/reflex';
import { NalVetoArbitration, WeightedQuorum } from '@senars/nar/reflex';
import { CognitiveRegistry } from '@senars/nar/cognitive';
import { MetricsCollector } from '@senars/nar/metrics';
import { composeStrategy, describeStrategyExpression } from '@senars/nar/reason/strategy-algebra.js';
import { CognitiveController } from '@senars/nar/cognitive/controller.js';
import type { DerivationContext, DerivationStrategy } from '@senars/nar/strategies';
import type { Task } from '@senars/nar/types';
import type { JudgmentManifold, JudgmentProposition } from '@senars/nar/lm/system-one/types.js';
import { createMeTTa, parseMeTTa } from '@senars/metta';
import { describe, expect, it } from 'vitest';

// ── fixtures ──────────────────────────────────────────────────────────────

const makeTask = (name: string): Task =>
  createTask(TermBuilder.inheritance(atom(name), atom('X'))!, 'belief', Truth.TRUE);

const ctx = (signal?: AbortSignal): DerivationContext => ({
  maxDerivations: 100,
  maxDepth: 5,
  cpuThrottleMs: 0,
  singlePremiseEnabled: false,
  ...(signal ? { signal } : {}),
});

// Deterministic fake primitives: 'emit:<n>' yields n tasks, 'slow' yields one
// after 80 ms, 'never' yields none.
const fakeStrategy = (name: string): DerivationStrategy => ({
  metadata: { name, description: 'fake' },
  async *derive(_primary: Task, _s: Task[], _p: RuleProcessor, c: DerivationContext) {
    if (name.startsWith('emit:')) {
      for (let i = 0; i < Number(name.slice(5)); i++) {
        if (c.signal?.aborted) return;
        yield makeTask(`t${i}`);
      }
    } else if (name === 'slow') {
      await new Promise((r) => setTimeout(r, 80));
      if (c.signal?.aborted) return;
      yield makeTask('t0');
    }
  },
});
const resolver = (name: string): DerivationStrategy => fakeStrategy(name);

/**
 * Non-vetoing manifold stub: every head classifies as 'belief' with p 0.95 —
 * the injection evaluate-head never trips, so reputation ceilings are the only
 * variance in admission truth (Bench 90's tested surface).
 */
const stubManifold = (): JudgmentManifold => {
  const prop = (i: number): JudgmentProposition =>
    ({
      queryId: `q${i}`,
      backendId: 'stub',
      modelDigest: 'sha256:stub',
      calibration: { version: 'v1.0.0', ece: 0 },
      latencyMs: 0,
      cost: { tokensIn: 0, tokensOut: 0, computeMs: 0, memoryMb: 0 },
      tier: 0,
      abstained: false,
      kind: 'classify',
      axis: 'epistemic',
      distribution: [],
      top: { option: 'belief', p: 0.95 },
      entropy: 0,
    }) as never;
  return {
    judgeBatch: async (_ctx, queries) => queries.map((_, i) => prop(i)),
    consensus: async () => ({ proposition: prop(0), agreement: 1, independent: true }),
    health: () => ({ backendId: 'stub' as never, ready: true, breakerOpen: false, rollingEce: 0, queueDepth: 0 }),
  };
};

const judgeRequest = () => ({
  rawObservation: 'observation text',
  sourceQuality: 'PRIMARY' as const,
  baseConfidence: 0.9,
  taskType: 'belief' as const,
});

const mettaEvaluate = (engine: ReturnType<typeof createMeTTa>) => (expr: string): boolean | null => {
  try {
    const result = Effect.runSync(engine.evaluate(parseMeTTa(expr)));
    return result.kind === 0 ? (result.value === 'True' ? true : result.value === 'False' ? false : null) : null;
  } catch {
    return null;
  }
};

// ── strategy algebra ──────────────────────────────────────────────────────

describe('Bench 90 — strategy composition algebra', () => {
  it('sequence runs stages in order', async () => {
    const s = composeStrategy({ op: 'sequence', stages: ['emit:1', 'emit:2'] }, resolver);
    const tasks: string[] = [];
    for await (const t of s.derive(makeTask('p'), [], new RuleProcessor() as never, ctx()))
      tasks.push(String(t.term));
    expect(tasks).toEqual(['(t0 --> X)', '(t0 --> X)', '(t1 --> X)']);
  });

  it('parallel takes the first result exclusively', async () => {
    const firstWins = composeStrategy(
      { op: 'parallel', branches: ['never', 'emit:2'] },
      resolver
    );
    const tasks: string[] = [];
    for await (const t of firstWins.derive(makeTask('p'), [], new RuleProcessor() as never, ctx()))
      tasks.push(String(t.term));
    expect(tasks).toEqual(['(t0 --> X)', '(t1 --> X)']);

    const exclusive = composeStrategy({ op: 'parallel', branches: ['emit:1', 'emit:9'] }, resolver);
    const onlyOne: string[] = [];
    for await (const t of exclusive.derive(makeTask('p'), [], new RuleProcessor() as never, ctx()))
      onlyOne.push(String(t.term));
    expect(onlyOne).toEqual(['(t0 --> X)']);
  });

  it('conditional branches on the predicate', async () => {
    const s = composeStrategy(
      {
        op: 'conditional',
        when: (t: Task) => String(t.term).includes('p'),
        // `then` is the algebra's field name (REFACTOR.todo2 §3); not a promise.
        // biome-ignore lint/suspicious/noThenProperty: spec'd expression field
        then: 'emit:1',
        otherwise: 'emit:3',
      } as const,
      resolver
    );
    const hit: string[] = [];
    for await (const t of s.derive(makeTask('p'), [], new RuleProcessor() as never, ctx()))
      hit.push(String(t.term));
    const miss: string[] = [];
    for await (const t of s.derive(makeTask('q'), [], new RuleProcessor() as never, ctx()))
      miss.push(String(t.term));
    expect(hit).toEqual(['(t0 --> X)']);
    expect(miss).toEqual(['(t0 --> X)', '(t1 --> X)', '(t2 --> X)']);
  });

  it('loop is bounded and stops when the body yields nothing', async () => {
    const s = composeStrategy({ op: 'loop', body: 'emit:1', maxIterations: 5 }, resolver);
    const tasks: Task[] = [];
    for await (const t of s.derive(makeTask('p'), [], new RuleProcessor() as never, ctx())) tasks.push(t);
    expect(tasks).toHaveLength(5);

    const empty = composeStrategy({ op: 'loop', body: 'never', maxIterations: 5 }, resolver);
    const none: Task[] = [];
    for await (const t of empty.derive(makeTask('p'), [], new RuleProcessor() as never, ctx())) none.push(t);
    expect(none).toHaveLength(0);
  });

  it('timeout falls back to the fallback branch when the timer fires', async () => {
    const s = composeStrategy(
      { op: 'timeout', ms: 20, body: 'slow', fallback: 'emit:1' },
      resolver
    );
    const tasks: string[] = [];
    for await (const t of s.derive(makeTask('p'), [], new RuleProcessor() as never, ctx()))
      tasks.push(String(t.term));
    expect(tasks).toEqual(['(t0 --> X)']);
  });

  it('combinators respect an already-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const sequence = composeStrategy({ op: 'sequence', stages: ['emit:1'] }, resolver);
    const seq: Task[] = [];
    for await (const t of sequence.derive(makeTask('p'), [], new RuleProcessor() as never, ctx(controller.signal)))
      seq.push(t);
    expect(seq).toHaveLength(0);

    const loop = composeStrategy({ op: 'loop', body: 'emit:1', maxIterations: 3 }, resolver);
    const looped: Task[] = [];
    for await (const t of loop.derive(makeTask('p'), [], new RuleProcessor() as never, ctx(controller.signal)))
      looped.push(t);
    expect(looped).toHaveLength(0);
  });

  it('descriptions are deterministic labels', () => {
    expect(describeStrategyExpression('default')).toBe('default');
    expect(describeStrategyExpression({ op: 'sequence', stages: ['focused', 'anytime'] })).toBe(
      'seq(focused,anytime)'
    );
    expect(
      describeStrategyExpression({ op: 'timeout', ms: 100, body: 'default', fallback: 'anytime' })
    ).toBe('timeout(100,default)');
  });
});

// ── controller wiring (C7 plain-name parity) ─────────────────────────────

describe('Bench 90 — controller wiring', () => {
  const makeController = () => {
    const registry = new CognitiveRegistry();
    registry.initializeDefaults();
    const nar = createMinimalNAR();
    const controller = new CognitiveController(
      registry,
      nar.memory,
      new RuleProcessor(),
      (nar as unknown as { metrics?: MetricsCollector }).metrics ?? new MetricsCollector(),
      undefined,
      structuredClone(DEFAULT_COGNITIVE_PARAMETERS),
      50
    );
    return { controller, registry };
  };

  it('plain-name setStrategy resolves exactly as before (C7)', () => {
    const { controller } = makeController();
    expect(controller.getStrategy('derivation')).toBe('default');
    controller.setStrategy('derivation', 'focused');
    expect(controller.getStrategy('derivation')).toBe('focused');
  });

  it('setStrategyExpression registers a composed strategy by its deterministic label', () => {
    const { controller, registry } = makeController();
    controller.setStrategyExpression('derivation', {
      op: 'sequence',
      stages: ['default', 'default'],
    });
    expect(controller.getStrategy('derivation')).toBe('composed:seq(default,default)');
    expect(registry.has('derivation', 'composed:seq(default,default)')).toBe(true);
    // Idempotent: re-registering the same expression reuses the entry.
    controller.setStrategyExpression('derivation', { op: 'sequence', stages: ['default', 'default'] });
    expect(controller.getStrategy('derivation')).toBe('composed:seq(default,default)');
  });

  it('setStrategy accepts an expression inline (RetrospectiveAdapter path)', () => {
    const { controller, registry } = makeController();
    controller.setStrategy('derivation', { op: 'timeout', ms: 50, body: 'default', fallback: 'anytime' });
    expect(controller.getStrategy('derivation')).toBe('composed:timeout(50,default)');
    expect(registry.has('derivation', 'composed:timeout(50,default)')).toBe(true);
  });
});

// ── consensus: WeightedQuorum + MettaProposer ────────────────────────────

describe('Bench 90 — consensus', () => {
  const go = { action: 'go', value: 0.9, confidence: 0.9, source: 'reflex' };
  const trap = { action: 'trap', value: 0.9, confidence: 0.9, source: 'reflex' };

  it('default arbitration stays NAL veto (plain Negotiator parity)', () => {
    const nal = new Negotiator();
    const supportive = nal.resolve([go], [{ action: 'go', truth: { f: 0.9, c: 0.9 }, source: 'b1' }]);
    expect(supportive.action).toBe('go');
    expect(supportive.vetoedBy).toBeNull();
    const vetoed = nal.resolve([trap], [{ action: 'trap', truth: { f: 0.1, c: 0.95 }, source: 'b1' }]);
    expect(vetoed.vetoedBy).toBe('nal-b1');
    expect(vetoed.actionExecuted).toBeNull();
  });

  it('WeightedQuorum: NAL support adds weight; a confirmed trap sinks below the floor', () => {
    const quorum = new WeightedQuorum();
    const supported = quorum.decide([go], [{ action: 'go', truth: { f: 0.9, c: 0.9 }, source: 'b1' }]);
    expect(supported.action).toBe('go');

    // 0.81 reflex base − 0.95 opposing vote ⇒ below the quorum floor ⇒ yield.
    const sunk = quorum.decide([trap], [{ action: 'trap', truth: { f: 0.1, c: 0.95 }, source: 'b1' }]);
    expect(sunk.action).toBeNull();

    // Mixed evidence: supportive derivation outvotes the trap ⇒ acts (≠ NAL veto).
    const mixed = quorum.decide(
      [trap],
      [
        { action: 'trap', truth: { f: 0.1, c: 0.95 }, source: 'b1' },
        { action: 'trap', truth: { f: 0.9, c: 0.9 }, source: 'b2' },
      ]
    );
    expect(mixed.action).toBe('trap');
  });

  it('WeightedQuorum respects the reflex threshold and empty inputs', () => {
    const quorum = new WeightedQuorum({ reflexThreshold: 0.5 });
    expect(quorum.decide([], [])).toMatchObject({ action: null, source: 'none' });
    const weak = quorum.decide(
      [{ action: 'w', value: 0.3, confidence: 0.9, source: 'r' }],
      []
    );
    expect(weak.action).toBeNull();
  });

  it('MettaProposer votes confidence 1.0 on exact algebra via the real engine', () => {
    const evaluate = mettaEvaluate(createMeTTa());
    // The `=` op is structural (no pre-reduction of args): ground pairs evaluate.
    expect(evaluate('(= 4 4)')).toBe(true);
    expect(evaluate('(= 4 5)')).toBe(false);
    expect(evaluate('(+ 2 3)')).toBeNull(); // reduced to symbol '5' — neither True nor False

    const proposer = new MettaProposer(evaluate, {
      toExpression: (action) => `(= 2 ${action === 'good' ? '2' : '3'})`,
    });
    const out = proposer.propose({
      reflexProposals: [
        { action: 'good', value: 0.5, confidence: 0.5, source: 'reflex' },
        { action: 'bad', value: 0.9, confidence: 0.9, source: 'reflex' },
      ],
      nalDerivations: [],
    });
    expect(out.reflex).toHaveLength(1);
    expect(out.reflex![0]).toMatchObject({ action: 'good', confidence: 1.0, source: 'metta' });
  });

  it('MettaProposer abstains when the engine disagrees or is absent', () => {
    const evaluate = mettaEvaluate(createMeTTa());
    const disagreeing = new MettaProposer(evaluate, {
      toExpression: (action) => `(= (+ 2 2) ${action === 'good' ? '5' : '4'})`,
    });
    expect(
      disagreeing.propose({
        reflexProposals: [{ action: 'good', value: 0.9, confidence: 0.9, source: 'r' }],
        nalDerivations: [],
      })
    ).toEqual({});

    const offEngine = new MettaProposer(() => null);
    expect(
      offEngine.propose({
        reflexProposals: [{ action: 'a', value: 1, confidence: 1, source: 'r' }],
        nalDerivations: [],
      })
    ).toEqual({});
  });

  it('proposer merge: the MeTTa-backed contribution dominates arbitration', () => {
    const proposer = new MettaProposer((expr) => expr.includes('good'), {
      toExpression: (action) => `assert:${action}`,
    });
    // Production GameFocus wiring uses reflexThreshold: -1 (kernel-gated).
    const neg = new Negotiator({ proposers: [proposer], reflexThreshold: -1 });
    const decision = neg.resolve([{ action: 'good', value: 0.2, confidence: 0.4, source: 'reflex' }], []);
    expect(decision.action).toBe('good');
    expect(decision.source).toBe('reflex');
  });

  it('learn fans out to registered proposers', () => {
    let learned = 0;
    const counting = {
      propose: () => ({}),
      learn: () => {
        learned++;
      },
    };
    const neg = new Negotiator({ proposers: [counting] });
    neg.learn({} as never);
    expect(learned).toBe(1);
    expect(neg.registeredProposers).toHaveLength(1);
  });
});

// ── reputation key granularity ───────────────────────────────────────────

describe('Bench 90 — reputation keys', () => {
  it('derives provider:/domain: keys; plain ids pass through', () => {
    expect(providerKey('llamacpp')).toBe('provider:llamacpp');
    expect(providerKey(undefined)).toBeUndefined();
    expect(providerKey('  ')).toBeUndefined();
    expect(domainKey('https://example.com/x?y=1')).toBe('domain:example.com');
    expect(domainKey('see https://a.b/c and http://d.e/f')).toBe('domain:a.b');
    expect(domainKey('plain-peer-id')).toBeUndefined();
  });

  it('per-key isolation: one provider’s contradictions don’t move another’s ceiling', () => {
    const rep = new SourceReputation({ floor: 0.4 });
    for (let i = 0; i < 4; i++) rep.record('provider:anthropic', 'contradicted');
    expect(rep.multiplier('provider:anthropic')).toBeLessThan(1);
    expect(rep.multiplier('provider:llamacpp')).toBe(1);
    expect(rep.multiplier('system-one')).toBe(1);
  });

  it('legacy fallback parity: no provider ⇒ the system-one key governs; with one ⇒ finer key', async () => {
    const rep = new SourceReputation({ floor: 0.2 });
    rep.record('system-one', 'contradicted');
    rep.record('system-one', 'contradicted');
    rep.record('provider:llamacpp', 'confirmed');

    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
    const budget = {
      maxCycles: 10,
      maxDepth: 3,
      maxMemoryOps: 100,
      maxLMCalls: 2,
      consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
    };
    const makeJudge = (provider?: () => string | undefined) =>
      new SystemOneIngressJudge({
        manifold: stubManifold(),
        embeddingCache: cache,
        budget,
        reputation: () => rep,
        ...(provider ? { provider } : {}),
      });

    // Both judges lack a provider ⇒ both fall back to 'system-one' (degraded).
    const legacyA = await makeJudge().judge(judgeRequest());
    const legacyB = await makeJudge().judge(judgeRequest());
    expect(legacyA.truth.c).toBe(legacyB.truth.c);
    expect(legacyA.truth.c).toBeLessThan(1);

    // Provider-wired judge uses the clean provider:llamacpp key ⇒ full ceiling.
    const fine = await makeJudge(() => 'llamacpp').judge(judgeRequest());
    expect(fine.truth.c).toBeGreaterThan(legacyA.truth.c);
  });

  it('perception gate keys URL-bearing source ids by domain; plain ids unchanged', async () => {
    const rep = new SourceReputation({ floor: 0.1 });
    rep.record('domain:bad.example', 'contradicted');
    rep.record('domain:bad.example', 'contradicted');
    const gate = new KernelPerceptionGate();
    gate.setReputation(rep);
    const degraded = await gate.admit({
      sourceId: 'https://bad.example/page',
      rawObservation: 'x',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    const neutral = await gate.admit({
      sourceId: 'https://good.example/page',
      rawObservation: 'x',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    expect(degraded.task!.truth!.confidence).toBeLessThan(neutral.task!.truth!.confidence);

    // Plain (non-URL) ids keep exact legacy behavior.
    const plain = new KernelPerceptionGate();
    plain.setReputation(rep);
    const before = await plain.admit({
      sourceId: 'user-peer-7',
      rawObservation: 'x',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    rep.record('user-peer-7', 'contradicted');
    rep.record('user-peer-7', 'contradicted');
    const after = await plain.admit({
      sourceId: 'user-peer-7',
      rawObservation: 'x',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    expect(after.task!.truth!.confidence).toBeLessThan(before.task!.truth!.confidence);
  });

  it('ingress judge without provider keeps the exact legacy key path (byte parity)', async () => {
    const rep = new SourceReputation();
    const judge = new SystemOneIngressJudge({
      manifold: stubManifold(),
      embeddingCache: new EmbeddingCache({ maxSize: 10, ttlMs: 60_000 }),
      budget: {
        maxCycles: 5,
        maxDepth: 2,
        maxMemoryOps: 50,
        maxLMCalls: 1,
        consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
      },
      reputation: () => rep,
      sourceKey: 'system-one',
    });
    const legacy = new SystemOneIngressJudge({
      manifold: stubManifold(),
      embeddingCache: new EmbeddingCache({ maxSize: 10, ttlMs: 60_000 }),
      budget: {
        maxCycles: 5,
        maxDepth: 2,
        maxMemoryOps: 50,
        maxLMCalls: 1,
        consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
      },
      reputation: () => rep,
      sourceKey: 'system-one',
    });
    const a = await judge.judge(judgeRequest());
    const b = await legacy.judge(judgeRequest());
    expect(a.truth).toEqual(b.truth);
  });
});

// ── reputation-fed probe curriculum ──────────────────────────────────────

describe('Bench 90 — curriculum reputation feed', () => {
  const episode = (turnId: string, sourceKey?: string) => ({
    id: turnId,
    type: 'reaction' as const,
    timestamp: Date.now(),
    content: JSON.stringify({ turnId, kind: 'correct' }),
    sessionId: 's1',
    metadata: { turnId, kind: 'correct', ...(sourceKey ? { sourceKey } : {}) },
  });

  it('probes target low-reputation keys: degraded sources float to the head', async () => {
    const rep = new SourceReputation({ floor: 0.2 });
    rep.record('provider:flaky', 'contradicted');
    rep.record('provider:flaky', 'contradicted');
    const reactions = [
      episode('reliable-turn', 'provider:solid'),
      episode('flaky-turn', 'provider:flaky'),
      episode('unknown-turn'),
    ];
    const probes = await selectProbes(
      { reactions: async () => reactions, grades: () => new Map() },
      { sourceReputation: { multiplier: (key) => rep.multiplier(key) } }
    );
    expect(probes[0]!.id).toBe('flaky-turn');
    // Reliable and unknown sources keep the base correction score.
    const base = probes.find((p) => p.id === 'reliable-turn')!;
    const unknown = probes.find((p) => p.id === 'unknown-turn')!;
    expect(base.score).toBe(unknown.score);
    expect(probes[0]!.score).toBeGreaterThan(base.score);
  });

  it('no reputation accessor ⇒ identical ordering to the legacy behavior', async () => {
    const reactions = [episode('a', 'provider:x'), episode('b', 'provider:y')];
    const withOption = await selectProbes(
      { reactions: async () => reactions, grades: () => new Map() },
      { sourceReputation: { multiplier: () => 1 } }
    );
    const legacy = await selectProbes({ reactions: async () => reactions, grades: () => new Map() });
    expect(withOption).toEqual(legacy);
  });
});
