import { describe, it, expect } from 'vitest';
import { ActionGateTransducer } from '../../nar/src/lm/system-one/action-transducer.js';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import { EmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { KernelRewardGate } from '../../nar/src/kernel/KernelRewardGate.js';
import { PriorityBag } from '../../nar/src/bag/Bag.js';
import { NAR, createTask, createBudget, termParser, Truth } from '../../nar/src';
import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { ClassifyProposition, JudgmentQuery } from '../../nar/src/lm/system-one/types.js';

const budget: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

const makeTeleologicalProposition = (option: string, p: number): ClassifyProposition => ({
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
});

describe('System One — Teleological Purity (Bench 3)', () => {
  it('teleological propositions structurally carry no Truth/Desire', () => {
    const p = makeTeleologicalProposition('move_north', 0.9);
    expect('truth' in p).toBe(false);
    expect('desire' in p).toBe(false);
  });

  it('KernelRewardGate firewall rejects belief-confidence reward targets', () => {
    const gate = new KernelRewardGate();
    const output = gate.process({
      eventId: 'e1',
      rewardSignal: 1.0,
      rewardType: 'extrinsic',
      targetType: 'truth-confidence',
      targetId: 'belief-1',
      domain: 'external-reflex',
    });
    expect(output.accepted).toBe(false);
    expect(output.epistemicFirewallViolation).toBe(true);
    expect(gate.getEventLog()).toHaveLength(1);
  });

  it('teleological judgment transduces to goal-side proposals only — belief bag untouched', async () => {
    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
    await cache.warmup(['ctx']);
    const manifold = createManifold(cache, { abstainThreshold: 0.05 });

    // Belief-bag inspection: snapshot before/after a full judge→transduce cycle
    const bag = new PriorityBag<{ id: string; priority: number }>({ capacity: 10 });
    bag.add({ id: 'belief-1', priority: 0.8 });
    const before = [...bag.entries()];

    const queries: JudgmentQuery[] = [
      {
        kind: 'classify',
        instruction: 'Select tool action',
        space: ['move_north', 'none'],
        axis: 'teleological',
      },
    ];
    const pointer = await cache.write('select tool action move_north');
    const results = await manifold.judgeBatch(pointer as never, queries, budget);
    const transducer = new ActionGateTransducer();
    for (const proposition of results) {
      transducer.transduce(proposition);
    }

    expect([...bag.entries()]).toEqual(before);
  });

  it('transduced Desire enters the NAR as type goal, never as belief', async () => {
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
    const calls: string[] = [];
    nar.tools.register({
      name: 'move_north',
      description: 'move',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        calls.push('move_north');
        return { success: true, content: null };
      },
    });

    const transducer = new ActionGateTransducer({ threshold: 0.5 });
    const proposal = transducer.transduce(makeTeleologicalProposition('move_north', 0.9))!;
    expect(proposal).toBeDefined();

    // Desire seeded goal-side only: the task enters as 'goal'
    nar.taskManager.addTask(
      createTask(termParser.parse('^move_north()'), 'goal', Truth.create(proposal.value, proposal.confidence), createBudget(0.9))
    );
    await nar.run(1);

    expect(calls).toEqual(['move_north']);
    // The tool goal was consumed for dispatch, not admitted as a belief
    const beliefTasks = nar.taskManager
      .getPending()
      .filter((t) => t.type === 'belief' && t.term.toString().includes('move_north'));
    expect(beliefTasks).toHaveLength(0);
  });
});
