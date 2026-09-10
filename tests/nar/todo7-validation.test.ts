import { describe, expect, it } from 'vitest';
import {
  atom,
  Concept,
  createBudget,
  RuleProcessor,
  Stamp,
  TermBuilder,
  Truth,
} from '../../nar/src/index.js';
import { CapabilitySpace } from '../../nar/src/capability/space.js';
import { Focus } from '../../nar/src/focus/Focus.js';
import { FocusBag } from '../../nar/src/focus/FocusBag.js';
import { KernelBudgetGate } from '../../nar/src/kernel/KernelBudgetGate.js';
import { KernelRewardGate } from '../../nar/src/kernel/KernelRewardGate.js';
import { gateRegistry } from '../../nar/src/kernel/GateRegistry.js';
import { toFormalizationBatch } from '../../nar/src/nl/understanding.js';
import { verifyRecord } from '../../scripts/verify-derivation.js';
import { v4 as uuidv4 } from 'uuid';

describe('TODO7 validation benchmarks', () => {
  it('1. evidence laundering: looped reinforcement cannot inflate confidence', () => {
    const term = TermBuilder.inheritance(atom('whiskers'), atom('cat'))!;
    const concept = new Concept(term);
    const truth = Truth.create(0.9, 0.8);
    expect(concept.addTask('belief', { term, truth, budget: createBudget(0.5), stamp: Stamp.createInput() })).toBe(true);
    const before = concept.getBeliefs()[0]?.truth;
    for (let i = 0; i < 5; i++) {
      concept.addTask('belief', { term, truth, budget: createBudget(0.5), stamp: Stamp.createInput() });
    }
    expect(concept.getBeliefs()).toHaveLength(1);
    expect(concept.getBeliefs()[0]?.truth?.c).toBe(before?.c);
  });

  it('2. translation ambiguity: nuance yields flagged candidates, not one confident parse', () => {
    const batch = toFormalizationBatch('Cats may eat fish unless served meat, and never drink milk', {
      beliefs: [{ narsese: '(cat --> fish-eater)', source: 'user' }],
      questions: [{ narsese: '(cat --> ?diet)' }],
      goals: [{ narsese: '(cat --> healthy)' }],
      meta: { detectedIntent: 'reasoning', ambiguities: [], coreferences: [], implicitContext: [] },
    });
    expect(batch.candidates.length).toBeGreaterThan(1);
    const types = new Set(batch.candidates.flatMap((c) => c.ambiguityFlags.map((f) => f.type)));
    expect(types.has('negation')).toBe(true);
    expect(types.has('modal')).toBe(true);
  });

  it('4. contradiction resilience: rival beliefs coexist with distinct truth', () => {
    const term = TermBuilder.inheritance(atom('sensor-A'), atom('online'))!;
    const negated = TermBuilder.negation(term);
    const concept = new Concept(term);
    expect(concept.addTask('belief', {
      term, truth: Truth.create(0.9, 0.9), budget: createBudget(0.5), stamp: Stamp.createInput(),
    })).toBe(true);
    expect(concept.addTask('belief', {
      term: negated, truth: Truth.create(0.1, 0.7), budget: createBudget(0.5), stamp: Stamp.createInput(),
    })).toBe(true);
    const beliefs = concept.getBeliefs();
    expect(beliefs).toHaveLength(2);
    expect(new Set(beliefs.map((b) => b.truth?.f)).size).toBe(2);
  });

  it('5. proof replay: engine records verify standalone', () => {
    const processor = new RuleProcessor();
    processor.setConfig({ recorderEnabled: true });
    const p1 = { term: TermBuilder.inheritance(atom('A'), atom('B'))!, truth: Truth.create(0.9, 0.9), stamp: Stamp.createInput() };
    const p2 = { term: TermBuilder.inheritance(atom('B'), atom('C'))!, truth: Truth.create(0.8, 0.9), stamp: Stamp.createInput() };
    const results = processor.processSync(p1, p2);
    expect(results.length).toBeGreaterThan(0);
    const records = processor.getRecorder().drain();
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      const verdict = verifyRecord(record);
      expect(verdict.findings).toEqual([]);
      expect(verdict.passed).toBe(true);
    }
  });

  it('6. scheduler fairness: low-priority focus keeps a nonzero share', () => {
    const bag = new FocusBag({ capacity: 10 });
    const hot = new Focus({ id: 'hot', weight: 1.0 });
    const cold = new Focus({ id: 'cold', weight: 0.01 });
    bag.add(hot);
    bag.add(cold);
    expect(bag.allocateBudget(cold, 10000)).toBeGreaterThan(0);
    expect(bag.allocateBudget(hot, 10000)).toBeGreaterThan(bag.allocateBudget(cold, 10000));
  });

  it('7. sabotage: self-mod attacks are refused at three layers', async () => {
    const space = new CapabilitySpace({
      policy: { checkCommand: (command: string) => (command === 'read-env' ? { allowed: false, reason: 'secrets' } : { allowed: true }) },
      approval: { requestApproval: async () => ({ approved: false, feedback: 'denied' }) },
    });
    expect(space.validateDiff({ kind: 'disable-approval', payload: null }).allowed).toBe(false);
    space.register({ name: 'read-env', execute: () => process.env });
    space.register({ name: 'modify-code', risk: 'high', execute: () => 'patched' });
    expect((await space.execute('read-env')).success).toBe(false);
    expect((await space.execute('modify-code')).success).toBe(false);
    expect((await space.execute('no-such-cap')).success).toBe(false);
  });

  it('8. self-game metric-gaming: self-reward cannot touch truth or governance', async () => {
    const gate = new KernelRewardGate();
    for (const targetType of ['truth-frequency', 'truth-confidence'] as const) {
      const verdict = gate.process({ eventId: uuidv4(), rewardSignal: 1, rewardType: 'contradiction-reduction', targetType, targetId: 'belief-1' });
      expect(verdict.accepted).toBe(false);
      expect(verdict.epistemicFirewallViolation).toBe(true);
    }
    const space = new CapabilitySpace({
      policy: { checkCommand: (c: string) => (c.startsWith('reward-model') || c.startsWith('approval') ? { allowed: false, reason: 'governed' } : { allowed: true }) },
    });
    space.register({ name: 'reward-model-edit', execute: () => 'edited' });
    expect((await space.execute('reward-model-edit')).success).toBe(false);
  });

  it('3. bounded degradation: exhaustion yields enums and partial results, never hangs', () => {
    const gate = new KernelBudgetGate({
      defaultBudget: { maxCycles: 2, maxDepth: 1, maxMemoryOps: 1, maxLMCalls: 0, consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 } },
    });
    expect(gate.check({ operation: 'nal-step' }).granted).toBe(true);
    expect(gate.check({ operation: 'nal-step' }).granted).toBe(true);
    const denied = gate.check({ operation: 'nal-step' });
    expect(denied.granted).toBe(false);
    expect(denied.terminationReason).toBe('cycle-budget');
  });

  it('3b. focus survives global budget exhaustion', async () => {
    const registryGate = gateRegistry.getBudgetGate();
    while (registryGate.check({ operation: 'nal-step', estimatedCost: 1 }).granted) { /* drain */ }
    const focus = new Focus({ id: 'degraded' });
    const report = await focus.step(5);
    expect(report.tasksProcessed).toBe(0);
    gateRegistry.reset();
  });
});
