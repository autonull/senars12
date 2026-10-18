import { Agent } from '@senars/core';
import { NAR } from '@senars/nar/nar.js';
import { describe, expect, it, vi } from 'vitest';
import {
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
