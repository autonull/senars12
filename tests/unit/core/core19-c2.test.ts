import { Agent } from '@senars/core';
import { NAR } from '@senars/nar/nar.js';
import { describe, expect, it, vi } from 'vitest';
import {
  handleCycleRewind,
  handleReasoningAdjustBudget,
  handleReasoningAdjustProvider,
} from '../../../ui/src/server/handlers.js';
import { e2eNARConfig } from '../../e2e/fixtures.js';

/**
 * CORE.19 C2 — kernel control plane.
 *
 * C2.4: `reasoning.adjust-budget`/`adjust-provider` work against the kernel gate
 * and the provider runtime, or reject with a reason — never the string
 * "is not yet wired to the engine" (D15).
 * C2.5: `Agent.capabilities()` reflects the wired subsystems, not a hardcoded
 * baseline.
 */

const buildNar = (): NAR => new NAR(e2eNARConfig({ persistState: false }));

interface Frame {
  type: string;
  ok: boolean;
  message?: string;
}

const fakeCtx = (nar: unknown): { ctx: unknown; frames: Frame[] } => {
  const frames: Frame[] = [];
  const ws = {
    readyState: 1,
    send: (raw: string) => frames.push(JSON.parse(raw) as Frame),
  };
  return { ctx: { nar: () => nar, ws, wss: { clients: new Set() } }, frames };
};

describe('CORE.19 C2.4 — adjust-budget / adjust-provider', () => {
  it('adjusts the kernel cycle ceiling through the gate', () => {
    const nar = buildNar();
    const before = nar.getBudget().maxCycles;
    nar.adjustCycleBudget(before + 500);
    expect(nar.getBudget().maxCycles).toBe(before + 500);
  });

  it('reports success and the new ceiling over the control protocol', () => {
    const nar = buildNar();
    const { ctx, frames } = fakeCtx(nar);
    handleReasoningAdjustBudget(ctx as never, { type: 'reasoning.adjust-budget', budget: 250 });
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ type: 'reasoning.control.response', ok: true });
    expect(nar.getBudget().maxCycles).toBe(250);
  });

  it('rejects with a typed reason when the engine cannot adjust', () => {
    const { ctx, frames } = fakeCtx({});
    handleReasoningAdjustBudget(ctx as never, { type: 'reasoning.adjust-budget', budget: 250 });
    expect(frames[0]).toMatchObject({ type: 'reasoning.control.response', ok: false });
    expect(frames[0]!.message).not.toContain('not yet wired');
  });

  it('selects a known provider and rejects an unknown one', () => {
    const selectProvider = vi.fn();
    const { ctx, frames } = fakeCtx({ getLMClient: () => ({ selectProvider }) });

    handleReasoningAdjustProvider(ctx as never, {
      type: 'reasoning.adjust-provider',
      provider: 'mock',
    });
    expect(selectProvider).toHaveBeenCalledWith('mock');
    expect(frames[0]).toMatchObject({ ok: true });

    handleReasoningAdjustProvider(ctx as never, {
      type: 'reasoning.adjust-provider',
      provider: 'not-a-provider',
    });
    expect(frames[1]).toMatchObject({ ok: false });
    expect(selectProvider).toHaveBeenCalledTimes(1);
  });

  it('rejects when no provider runtime is configured', () => {
    const { ctx, frames } = fakeCtx({});
    handleReasoningAdjustProvider(ctx as never, {
      type: 'reasoning.adjust-provider',
      provider: 'mock',
    });
    expect(frames[0]).toMatchObject({ ok: false });
  });
});

describe('CORE.19 C2.5 — honest capabilities', () => {
  it('reports the baseline when nothing is wired', () => {
    const agent = new Agent();
    expect(agent.capabilities().supports).toMatchObject({
      drives: false,
      rlfp: false,
      selfReasoning: false,
      autonomyLoop: false,
    });
  });

  it('reflects the subsystems the composition root wired', () => {
    const agent = new Agent({ capabilities: { drives: true, rlfp: true, selfReasoning: true } });
    expect(agent.capabilities().supports).toMatchObject({
      drives: true,
      rlfp: true,
      selfReasoning: true,
      autonomyLoop: false,
    });
  });
});

describe('CORE.19 C2.3/C2.6 — declared-partial rewind', () => {
  const build = (checkpointInterval: number): NAR =>
    new NAR(e2eNARConfig({ persistState: false, checkpointInterval }));

  const start = async (nar: NAR): Promise<void> => {
    await nar.initialize();
    await nar.start();
  };

  it('restores the nearest checkpoint and declares the gaps it cannot close', async () => {
    const nar = build(1);
    await start(nar);
    await nar.input('(a --> b).');
    await nar.run(3);
    expect(nar.getCycleCount()).toBe(3);

    const report = await nar.rewind(2);
    expect(report.checkpointed).toBe(true);
    expect(report.restored).toBe(1);
    expect(report.target).toBe(1);
    expect(nar.getCycleCount()).toBe(1);
    expect(report.gaps.join(' ')).toContain('RNG state');

    await nar.dispose();
  });

  it('rolls the graph back to the checkpoint, not only the counter', async () => {
    const nar = build(1);
    await start(nar);
    await nar.run(1);
    const conceptsAtCheckpoint = nar.memory.size;

    await nar.believe('(cat --> animal).');
    expect(nar.memory.size).toBeGreaterThan(conceptsAtCheckpoint);
    await nar.run(1);

    const report = await nar.rewind(1);
    expect(report.restored).toBe(1);
    expect(nar.memory.size).toBe(conceptsAtCheckpoint);

    await nar.dispose();
  });

  it('reports the nearest checkpoint when the target was not journaled', async () => {
    const nar = build(5);
    await start(nar);
    await nar.run(10);

    const report = await nar.rewind(3);
    expect(report.restored).toBe(5);
    expect(report.target).toBe(7);
    expect(report.gaps.join(' ')).toContain('nearest checkpoint at cycle 5');

    await nar.dispose();
  });

  it('reports no reachable checkpoint when checkpointing is off', async () => {
    const nar = build(0);
    await start(nar);
    await nar.run(3);

    const report = await nar.rewind(1);
    expect(report.checkpointed).toBe(false);
    expect(report.restored).toBe(3);
    expect(report.gaps.join(' ')).toContain('no checkpoint');

    await nar.dispose();
  });

  it('routes cycle.rewind through the server handler and reports the restore', async () => {
    const nar = build(1);
    await start(nar);
    await nar.run(2);

    const { ctx, frames } = fakeCtx(nar);
    await handleCycleRewind(ctx as never, { type: 'cycle.rewind', cycles: 1 });

    expect(
      frames.some((f) => f.type === 'reasoning.control.response' && f.ok)
    ).toBe(true);
    expect(frames.some((f) => f.type === 'cycle.state')).toBe(true);
    expect(nar.getCycleCount()).toBe(1);

    await nar.dispose();
  });
});
