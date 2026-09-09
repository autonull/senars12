import { describe, expect, it } from 'vitest';
import { PriorityBag } from '@senars/nar/bag';
import { SymbolicFirewall } from '@senars/nar/nl/firewall.js';
import { Negotiator } from '@senars/nar/reflex/Negotiator.js';
import { StreamReasoner } from '@senars/nar/stream/reasoner.js';
import { createDefaultHooks } from '@senars/nar/tick/bindings.js';
import { toCognitiveEvents } from '@senars/nar/tick/bridge.js';
import { createPipeline, createTickContext, runTick } from '@senars/nar/tick/tick.js';
import { TermBuilder, atom, createBudget, createTask } from '@senars/nar';

import { RLFPLearner } from '@senars/nar/rlfp/RLFPLearner.js';

const item = (id: string, priority: number) => ({ id, priority });

describe('TODO5b Phase 1', () => {
  it('universal Bag: pressure/sampleMany/evict', () => {
    const bag = new PriorityBag<{ id: string; priority: number }>({ capacity: 4 });
    expect(bag.pressure()).toBe(0);
    for (const [id, p] of [['a', 0.9], ['b', 0.5], ['c', 0.3], ['d', 0.1]] as const) bag.add(item(id, p));
    expect(bag.pressure()).toBe(1);
    expect(bag.sampleMany(2)).toHaveLength(2);
    bag.evict('LowestPriority');
    expect(bag.size()).toBe(3);
    bag.decay(0.5);
    expect(bag.size()).toBeGreaterThan(0);
  });

  it('tick pipeline runs all stages in order', async () => {
    const ctx = createTickContext('t1', { cycles: 10 });
    await runTick(ctx);
    expect(ctx.events.map((e) => e.stage)).toEqual([
      'perceive', 'recall', 'attend', 'reason', 'propose',
      'negotiate', 'authorize', 'act', 'validate', 'learn', 'consolidate',
    ]);
  });

  it('stream reasoner: provisional then revision, backpressure drops', async () => {
    const r = new StreamReasoner({ maxBatch: 2, highPressure: 0.85 });
    const prov = r.dispatch('cats?', { f: 0.8, c: 0.9 });
    expect(prov.settled).toBe(false);
    expect(prov.truth.c).toBeLessThan(0.5);
    const initial = prov.truth.c;
    const settled = await r.flush(async (reqs) => {
      const m = new Map();
      for (const q of reqs) m.set(q.id, { f: 0.9, c: 0.9 });
      return m;
    }, 0.2);
    expect(settled[0]?.settled).toBe(true);
    expect(settled[0]?.truth.c).toBeGreaterThan(initial);
    r.dispatch('q1');
    r.dispatch('q2');
    expect(await r.flush(async () => new Map(), 0.99)).toEqual([]);
  });

  it('firewall: truth sanity + whitelist', () => {
    const fw = new SymbolicFirewall({ allowedPredicates: ['cat', 'animal'] });
    expect(fw.checkTruth(0.8, 0.99).allowed).toBe(false);
    expect(fw.checkTruth(0.8, 0.5).allowed).toBe(true);
    expect(fw.check('(cat --> animal). %1.0;0.99%').allowed).toBe(false);
    expect(fw.check('(cat --> animal)').allowed).toBe(true);
    expect(fw.check('(dog --> animal)').allowed).toBe(false);
  });

  it('hooked pipeline mutates state through real hooks + reasoner fusion', async () => {
    const firewall = new SymbolicFirewall();
    const reasoner = new StreamReasoner();
    reasoner.dispatch('cats?', { f: 0.8, c: 0.9 });
    const ctx = createTickContext('t2', { cycles: 10 });
    await runTick(ctx, createPipeline({
      perceive: (c) => {
        if (firewall.check('(cat --> animal)').allowed) c.state.perceptions.push({ truth: { f: 1, c: 0.9 } } as never);
      },
      recall: (c) => {
        c.state.memories.push(...c.state.perceptions);
      },
      reason: reasoner.reasonHook(async (reqs) => {
        const m = new Map();
        for (const q of reqs) m.set(q.id, { f: 0.9, c: 0.9 });
        return m;
      }, () => 0.1),
      consolidate: (c) => {
        c.state.perceptions.length = 0;
      },
    }));
    expect(ctx.events).toHaveLength(11);
    expect(ctx.state.memories).toHaveLength(1);
    expect(ctx.state.derivations).toHaveLength(1);
    expect(ctx.state.perceptions).toHaveLength(0);
  });

  it('default bindings: negotiate veto, policy deny, tool act', async () => {
    const goalTerm = TermBuilder.inheritance!(
      TermBuilder.compound('product', [atom('fix_pattern:null_check')]),
      atom('^apply_fix'),
    );
    const goal = createTask(goalTerm, 'goal', { f: 1, c: 0.9 }, createBudget(0.9));
    const executed: string[] = [];
    const hooks = createDefaultHooks({
      stimuli: () => [createTask(atom('cat'), 'belief', { f: 1, c: 0.9 }, createBudget(0.5))],
      firewall: new SymbolicFirewall(),
      memory: { sample: () => [{ term: atom('cat'), priority: 0.8, beliefBag: { peek: () => ({ truth: { f: 1, c: 0.8 } }) } }] },
      focus: { id: 'f1', step: async () => ({ tasksProcessed: 3, derivations: 1 }) },
      focusBag: { allocateBudget: (_f, total) => total },
      proposers: [() => [goal]],
      negotiator: new Negotiator(),
      policy: { checkCommand: (cmd) => (cmd === 'apply_fix' ? { allowed: true } : { allowed: false, reason: 'denylist' }) },
      tools: { execute: async (name) => { executed.push(name); return { success: true }; } },
    });
    const ctx = createTickContext('t3', { cycles: 10 });
    await runTick(ctx, createPipeline(hooks));
    expect(ctx.state.perceptions).toHaveLength(0);
    expect(ctx.state.memories).toHaveLength(1);
    expect(ctx.state.actions).toHaveLength(1);
    expect(executed).toEqual(['apply_fix']);

    const vetoed = createTickContext('t4', { cycles: 10 });
    const vetoHooks = createDefaultHooks({
      proposers: [() => [goal]],
      negotiator: { resolve: () => ({ action: 'apply_fix', actionExecuted: null, vetoedBy: 'nal-test' }) },
      tools: { execute: async (name) => { executed.push(name); return { success: true }; } },
    });
    await runTick(vetoed, createPipeline(vetoHooks));
    expect(vetoed.state.actions).toHaveLength(0);
    expect(vetoed.events.some((e) => e.detail === 'veto:nal-test')).toBe(true);
    expect(executed).toEqual(['apply_fix']);
  });

  it('learn/validate/consolidate + core event bridge', async () => {
    let decayed = 0;
    let rewardSeen = -1;
    const hooks = createDefaultHooks({
      tools: { execute: async () => ({ success: true }) },
      proposers: [() => [createTask(atom('x'), 'goal', { f: 1, c: 0.9 }, createBudget(0.9))]],
      actionOf: () => ({ name: 'do_x', args: {} }),
      negotiator: { resolve: () => ({ action: 'do_x', actionExecuted: 'do_x', vetoedBy: null }) },
      validator: { check: (c) => ({ ok: c.state.outcomes.every((o) => o.success), reason: 'red' }) },
      onReward: (r) => { rewardSeen = r; },
      decayers: [{ decay: () => { decayed++; } }],
    });
    const ctx = createTickContext('t5', { cycles: 10 });
    await runTick(ctx, createPipeline(hooks));
    expect(ctx.state.outcomes).toHaveLength(1);
    expect(rewardSeen).toBe(1);
    expect(decayed).toBe(1);
    expect(ctx.events.some((e) => e.stage === 'learn' && e.detail === 'reward:1.000')).toBe(true);

    const events = toCognitiveEvents(ctx);
    expect(events.some((e) => e.type === 'tool.response')).toBe(true);
    expect(events[events.length - 1]?.type).toBe('cycle');

    const red = createTickContext('t6', { cycles: 10 });
    await runTick(red, createPipeline(createDefaultHooks({
      tools: { execute: async () => ({ success: false, error: 'boom' }) },
      proposers: [() => [createTask(atom('y'), 'goal', { f: 1, c: 0.9 }, createBudget(0.9))]],
      actionOf: () => ({ name: 'do_y', args: {} }),
      negotiator: { resolve: () => ({ action: 'do_y', actionExecuted: 'do_y', vetoedBy: null }) },
      validator: { check: () => ({ ok: false, reason: 'shadow red' }) },
    })));
    expect(red.state.outcomes).toHaveLength(0);
    expect(red.events.some((e) => e.detail === 'quarantined: shadow red')).toBe(true);
    expect(toCognitiveEvents(red).some((e) => e.type === 'tool.response' && (e.payload as { error?: string }).error === 'fail')).toBe(true);
  });

  it('learn uses real RLFPLearner extrinsic+intrinsic blend', async () => {
    const rlfp = new RLFPLearner();
    let rewardSeen = -1;
    const ctx = createTickContext('t7', { cycles: 10 });
    await runTick(ctx, createPipeline(createDefaultHooks({
      tools: { execute: async () => ({ success: true }) },
      proposers: [() => [createTask(atom('z'), 'goal', { f: 1, c: 0.9 }, createBudget(0.9))]],
      actionOf: () => ({ name: 'do_z', args: {} }),
      negotiator: { resolve: () => ({ action: 'do_z', actionExecuted: 'do_z', vetoedBy: null }) },
      rlfp,
      intrinsicOf: () => ({ contradictionReduction: 0.5 }),
      onReward: (r) => { rewardSeen = r; },
    })));
    const expected = rlfp.calculateRewardFromTask({ taskType: 'meta_reasoning', success: true, metrics: { passRate: 1, contradictionReduction: 0.5 } });
    expect(rewardSeen).toBe(expected);
    expect(rewardSeen).not.toBe(1);
  });
});
