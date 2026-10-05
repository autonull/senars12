import { describe, expect, it } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { KernelActionGate } from '../../nar/src/kernel/KernelActionGate.js';
import { KernelBudgetGate } from '../../nar/src/kernel/KernelBudgetGate.js';
import { KernelRewardGate } from '../../nar/src/kernel/KernelRewardGate.js';
import { projectOutcome } from '../../nar/src/kernel/gate-base.js';
import { prometheusRegistry } from '../../nar/src/metrics/prometheus.js';

/**
 * The one decision vocabulary, observed the way an operator observes it: as the
 * gate's own output plus the counters it meters.
 *
 * The reward gate is the case the unification exists for. Its output says
 * `accepted: true` and `requiresProposal: true` — nothing was mutated — so a
 * funnel that read the acceptance flag would meter a grant for a refusal.
 */
type Labels = Record<string, string>;

const counter = async (name: string, labels: Labels): Promise<number> => {
  const metrics = (await prometheusRegistry.getMetricsAsJSON()) as Array<{
    name: string;
    values: Array<{ labels: Labels; value: number }>;
  }>;
  const series = metrics.find((m) => m.name === name);
  return (
    series?.values.find((v) =>
      Object.entries(labels).every(([key, value]) => v.labels[key] === value)
    )?.value ?? 0
  );
};

const decisions = (gate: string, decision: string): Promise<number> =>
  counter('senars_gate_decisions_total', { gate, decision });

const vetoes = (gate: string, reason: string): Promise<number> =>
  counter('senars_gate_vetoes_total', { gate, reason });

describe('gate outcome', () => {
  it('meters an unauthorized action under `action`, not under the field name it reads', async () => {
    const gate = new KernelActionGate({ autonomyMode: 'observe-only' });
    const before = await decisions('action', 'denied');
    const out = gate.authorize({ proposalId: uuidv4(), operation: 'move', args: {} });
    expect(out.authorized).toBe(false);
    expect(await decisions('action', 'denied')).toBe(before + 1);
    expect(await vetoes('action', out.vetoReason!)).toBeGreaterThan(0);
  });

  it('meters a granted action as granted', async () => {
    const gate = new KernelActionGate({
      autonomyMode: 'sandbox-execute',
      allowedOperations: new Set(['move']),
    });
    const before = await decisions('action', 'granted');
    expect(gate.authorize({ proposalId: uuidv4(), operation: 'move', args: {} }).authorized).toBe(
      true
    );
    expect(await decisions('action', 'granted')).toBe(before + 1);
  });

  it('meters an exhausted budget as denied and names the termination reason', async () => {
    const gate = new KernelBudgetGate({
      defaultBudget: {
        maxCycles: 1,
        maxDepth: 10,
        maxMemoryOps: 10,
        maxLMCalls: 1,
        consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
      },
    });
    const before = await decisions('budget', 'denied');
    const out = gate.check({ operation: 'lm-call', estimatedCost: 100 });
    expect(out.granted).toBe(false);
    expect(out.terminationReason).toBeDefined();
    expect(await decisions('budget', 'denied')).toBe(before + 1);
  });

  it('reports a proposal-required reward as denied, because nothing was mutated', async () => {
    const gate = new KernelRewardGate();
    const before = await decisions('reward', 'denied');
    const out = gate.process({
      eventId: uuidv4(),
      rewardSignal: 0.5,
      rewardType: 'extrinsic',
      targetType: 'attention-priority',
      targetId: 'curiosity',
      domain: 'self-config-proposal',
    });
    // The gate's own output calls this accepted; the decision was not a grant.
    expect(out.accepted).toBe(true);
    expect(out.requiresProposal).toBe(true);
    expect(out.mutationApplied).toBe(false);
    expect(await decisions('reward', 'denied')).toBe(before + 1);
    expect(await vetoes('reward', 'requires-proposal')).toBeGreaterThan(0);
  });

  it('projects through one checked accessor rather than a field-name guess', () => {
    const project = projectOutcome<{ ok: boolean; why?: string }>(
      { ok: true },
      (o) => o.ok,
      (o) => o.why
    );
    expect(project).toEqual({ granted: true, reason: undefined });
  });
});
