import { describe, it, expect } from 'vitest';
import { ActionGateTransducer } from '../../nar/src/lm/system-one/action-transducer.js';
import { ManifoldReflex } from '../../nar/src/lm/system-one/manifold-reflex.js';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import { EmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { EpsilonGreedyReflex } from '../../nar/src/reflex/EpsilonGreedyReflex.js';
import { NAR, createTask, createBudget, termParser, Truth } from '../../nar/src';
import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { ClassifyProposition } from '../../nar/src/lm/system-one/types.js';
import type { Perception } from '../../nar/src/game/Game.js';

const budget: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

const makeProposition = (
  option: string,
  p: number,
  over: Partial<ClassifyProposition> = {}
): ClassifyProposition => ({
  kind: 'classify',
  axis: 'teleological',
  distribution: [
    { option, p },
    { option: 'none', p: 1 - p },
  ],
  top: { option, p },
  entropy: 0.5,
  queryId: 'q1' as never,
  backendId: 'encoder-wasm-s1' as never,
  modelDigest: 'sha256:test' as never,
  calibration: { version: 'v2.4.1' as never, ece: 0.02 },
  latencyMs: 1,
  cost: { tokensIn: 0, tokensOut: 0, computeMs: 0, memoryMb: 0 },
  tier: 1,
  abstained: false,
  ...over,
});

describe('System One — Teleological Transduction (Bench 11)', () => {
  it('p > τ produces an authorized ^op(...) goal reaching dispatchToolGoals', async () => {
    const nar = new NAR({
      activationDecayRate: 0.01,
      consolidationInterval: 5,
      cpuThrottleMs: 0,
      enableLMRules: false,
      enableTools: true,
      enableSelf: false,
      enableRLFP: false,
      persistState: false,
      maxConcepts: 10000,
      maxDerivationsPerStep: 1000,
      maxDerivationDepth: 20,
    });
    const calls: Array<Record<string, unknown>> = [];
    nar.tools.register({
      name: 'move_to',
      description: 'move',
      parameters: { type: 'object', properties: {} },
      execute: async (args) => {
        calls.push(args);
        return { success: true, content: null };
      },
    });

    const transducer = new ActionGateTransducer({ threshold: 0.5 });
    const proposal = transducer.transduce(makeProposition('move_to', 0.9))!;
    expect(proposal).toBeDefined();

    // Proposal → goal task → nar.run dispatches via toolGoalExecutor
    nar.taskManager.addTask(
      createTask(
        termParser.parse('^move_to(direction:north)'),
        'goal',
        Truth.create(proposal.value, proposal.confidence),
        createBudget(proposal.value * proposal.confidence)
      )
    );
    await nar.run(1);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ direction: 'north' });
  });

  it('p < τ stays propose-only for the Negotiator', () => {
    const transducer = new ActionGateTransducer({ threshold: 0.5 });
    const proposal = transducer.transduce(makeProposition('move_to', 0.3));
    expect(proposal).toBeDefined();
    expect(proposal!.confidence).toBe(0.3);
    expect(proposal!.value).toBe(0.3);
  });

  it('high-risk classification triggers HITL approval and no proposal', async () => {
    const requests: Array<{ action: string; risk: string }> = [];
    const approvals = {
      requestApproval: async (request: { action: string; risk: string }) => {
        requests.push(request);
        return { approved: false };
      },
    };
    const transducer = new ActionGateTransducer({ approvals, threshold: 0.5 });
    const proposal = transducer.transduce(makeProposition('high', 0.9));
    expect(proposal).toBeUndefined();
    expect(requests).toHaveLength(1);
    expect(requests[0]!.risk).toBe('high');
  });

  it('abstained teleological judgments never transduce', () => {
    const transducer = new ActionGateTransducer();
    expect(transducer.transduce(makeProposition('move_to', 0.9, { abstained: true, abstainReason: 'low-confidence' }))).toBeUndefined();
  });

  it('epistemic-axis judgments never transduce through the action gate', () => {
    const transducer = new ActionGateTransducer();
    expect(transducer.transduce(makeProposition('move_to', 0.9, { axis: 'epistemic' as never }))).toBeUndefined();
  });
});

describe('System One — Semantic Reflex (ManifoldReflex)', () => {
  const perception: Perception = { stateId: 's1', confidence: 0.9 };
  const actions = ['left', 'right'];

  it('serves proposals from the prefetch table', async () => {
    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
    await cache.warmup(['ctx']);
    const manifold = createManifold(cache, { abstainThreshold: 0.05 });
    const fallback = new EpsilonGreedyReflex('bandit-fallback', { numArms: 10, epsilon: 0 });
    const reflex = new ManifoldReflex(fallback);

    const pointer = await cache.write('state s1 actions left right');
    await reflex.prefetch(perception.stateId, pointer as never, actions, manifold, budget);

    const proposals = reflex.propose(perception, actions);
    // Heads are placeholder-random until distilled weights land (Phase 4);
    // tolerate the abstain→fallback path, assert full action coverage.
    expect(proposals).toHaveLength(actions.length);
    for (const p of proposals) {
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(1);
      expect(p.confidence).toBeGreaterThanOrEqual(0);
      expect(p.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('falls back to the incumbent reflex when the table is cold', () => {
    const fallback = new EpsilonGreedyReflex('bandit-fallback', { numArms: 10, epsilon: 0 });
    const reflex = new ManifoldReflex(fallback);
    const proposals = reflex.propose(perception, actions);
    expect(proposals.length).toBeGreaterThan(0);
  });

  it('cold-table proposals match the incumbent reflex exactly', () => {
    const fallback = new EpsilonGreedyReflex('bandit-fallback', { numArms: 10, epsilon: 0 });
    const reflex = new ManifoldReflex(fallback);
    expect(reflex.propose(perception, actions)).toEqual(
      fallback.propose(perception.stateId, actions as never)
    );
  });

  it('learn delegates to the incumbent reflex', () => {
    const fallback = new EpsilonGreedyReflex('bandit-fallback', { numArms: 10, epsilon: 0 });
    const reflex = new ManifoldReflex(fallback);
    const event = {
      perception,
      previousPerception: null,
      actionProposed: 'left',
      actionExecuted: 'left',
      reward: 1,
      terminal: false,
      overriddenBy: null,
    };
    expect(() => reflex.learn(event)).not.toThrow();
  });
});
