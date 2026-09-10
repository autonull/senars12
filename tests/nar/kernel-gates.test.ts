import { describe, expect, it } from 'vitest';
import { KernelPerceptionGate } from '../../nar/src/kernel/KernelPerceptionGate.js';
import { KernelBudgetGate } from '../../nar/src/kernel/KernelBudgetGate.js';
import { KernelRewardGate } from '../../nar/src/kernel/KernelRewardGate.js';
import { KernelActionGate } from '../../nar/src/kernel/KernelActionGate.js';
import { atom, TermBuilder } from '../../nar/src/terms/index.js';
import { v4 as uuidv4 } from 'uuid';

describe('kernel gates', () => {
  it('perception admits valid observation and admitTask preserves truth', () => {
    const gate = new KernelPerceptionGate();
    const out = gate.admit({ sourceId: 'user-cli', rawObservation: '(cat --> animal).', sensorConfidence: 1, sourceQuality: 'PRIMARY' });
    expect(out.admitted).toBe(true);
    expect(out.task?.taskType).toBe('belief');
    const direct = gate.admitTask(atom('cat'), 'belief', { frequency: 0.8, confidence: 0.9 }, 'derivation');
    expect(direct.admitted).toBe(true);
    expect(direct.task?.truth).toEqual({ frequency: 0.8, confidence: 0.9 });
    expect(direct.task?.term).toBe(atom('cat').toString());
    void TermBuilder;
  });

  it('perception rejects unparseable observation', () => {
    const gate = new KernelPerceptionGate();
    const out = gate.admit({ sourceId: 'sensor', rawObservation: 42, sensorConfidence: 1, sourceQuality: 'GENERAL' });
    expect(out.admitted).toBe(false);
  });

  it('budget exhausts with TerminationReason enum', () => {
    const gate = new KernelBudgetGate({ defaultBudget: { maxCycles: 1, maxDepth: 10, maxMemoryOps: 10, maxLMCalls: 1, consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 } } });
    expect(gate.check({ operation: 'nal-step' }).granted).toBe(true);
    const denied = gate.check({ operation: 'nal-step' });
    expect(denied.granted).toBe(false);
    expect(denied.terminationReason).toBe('cycle-budget');
    const log = gate.getEventLog();
    expect(log[0]?.payload.budgetType).toBe('cycles');
  });

  it('reward firewall accepts policy targets, blocks truth targets', () => {
    const gate = new KernelRewardGate();
    const ok = gate.process({ eventId: uuidv4(), rewardSignal: 0.5, rewardType: 'extrinsic', targetType: 'policy-weights', targetId: 'focus-1' });
    expect(ok.accepted).toBe(true);
    expect(gate.getEventLog()).toHaveLength(0);
    const blocked = gate.process({ eventId: uuidv4(), rewardSignal: 0.5, rewardType: 'extrinsic', targetType: 'truth-confidence', targetId: 'belief-1' });
    expect(blocked.accepted).toBe(false);
    expect(blocked.epistemicFirewallViolation).toBe(true);
    expect(gate.getEventLog()).toHaveLength(1);
  });

  it('action gate blocks in observe-only, allows explicit ops in sandbox-execute', () => {
    const gate = new KernelActionGate();
    expect(gate.authorize({ proposalId: uuidv4(), operation: 'move', args: {} }).authorized).toBe(false);
    gate.setAutonomyMode('sandbox-execute');
    gate.addAllowedOperation('move');
    const auth = gate.authorize({ proposalId: uuidv4(), operation: 'move', args: {} });
    expect(auth.authorized).toBe(true);
    expect(auth.toolCallId).toBeDefined();
  });

  it('NL batch converts to FormalizationCandidates with ambiguity flags', async () => {
    const { toFormalizationBatch, detectAmbiguityFlags } = await import('../../nar/src/nl/understanding.js');
    expect(detectAmbiguityFlags('Cats may eat unless served fish').map((f) => f.type)).toEqual(
      expect.arrayContaining(['negation', 'modal'])
    );
    expect(detectAmbiguityFlags('Cats are mammals')).toHaveLength(0);
    const batch = toFormalizationBatch('Whiskers may be a cat', {
      beliefs: [{ narsese: '(whiskers --> cat)', truth: { f: 0.8, c: 0.7 }, source: 'inferred' }],
      questions: [{ narsese: '(whiskers --> ?what)' }],
      goals: [],
      meta: { detectedIntent: 'reasoning', ambiguities: [], coreferences: [], implicitContext: [] },
    });
    expect(batch.candidates).toHaveLength(2);
    expect(batch.candidates[0]?.taskType).toBe('belief');
    expect(batch.candidates[0]?.truth).toEqual({ frequency: 0.8, confidence: 0.7 });
    expect(batch.candidates[0]?.ambiguityFlags.map((f) => f.type)).toContain('modal');
  });

  it('perception gate admits formalization candidates provisionally', async () => {
    const { toFormalizationBatch } = await import('../../nar/src/nl/understanding.js');
    const gate = new KernelPerceptionGate();
    const batch = toFormalizationBatch('Cats are mammals', {
      beliefs: [{ narsese: '(cat --> mammal)', source: 'user' }],
      questions: [],
      goals: [],
      meta: { detectedIntent: 'learning', ambiguities: [], coreferences: [], implicitContext: [] },
    });
    const { admitted, rejected } = gate.admitFormalization(batch, 'SECONDARY');
    expect(rejected).toHaveLength(0);
    expect(admitted).toHaveLength(1);
    expect(admitted[0]?.source).toBe('llm');
    expect(admitted[0]?.truth?.confidence).toBeCloseTo(0.7 * 0.7, 5);
    const bad = gate.admitFormalization({ ...batch, candidates: [{ ...batch.candidates[0]!, narsese: '(((' }] });
    expect(bad.rejected).toHaveLength(1);
    expect(bad.admitted).toHaveLength(0);
  });

  it('action gate honors NAL veto registry', () => {
    const gate = new KernelActionGate({ autonomyMode: 'sandbox-execute', allowedOperations: new Set(['fire']) });
    gate.registerNALDerivation('d1', 'fire leads to trap', true);
    const out = gate.authorize({ proposalId: uuidv4(), operation: 'fire', args: {}, nalDerivationId: 'd1' });
    expect(out.authorized).toBe(false);
    expect(out.vetoReason).toMatch(/NAL veto/);
  });
});
