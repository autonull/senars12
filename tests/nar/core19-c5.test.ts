import { describe, expect, it } from 'vitest';
import {
  AUTONOMY_MODES,
  AUTONOMY_POLICIES,
  DEFAULT_AUTONOMY_CONFIG,
  resolveAutonomyConfig,
  Truth,
  type AutonomyConfigInput,
} from '@senars/nar';
import type { NARConfig } from '@senars/nar/facade/config.js';
import { NAR } from '@senars/nar/nar.js';
import { NarEventBus } from '@senars/nar/types/events.js';
import { e2eNARConfig } from '../e2e/fixtures.js';

/**
 * CORE.19 C5 — autonomy core.
 *
 * The kernel-owned heartbeat advances unasked (observable on the one bus),
 * curiosity mints a provenance-carrying question, consolidation reports its
 * pass, every policy has an off switch, and a spent window budget stops a
 * runaway loop (D16).
 */

interface Captured {
  channel: string;
  payload: unknown;
}

const buildNar = (
  autonomy: AutonomyConfigInput
): { nar: NAR; events: Captured[] } => {
  const bus = new NarEventBus();
  const events: Captured[] = [];
  const config: NARConfig = e2eNARConfig({ eventBus: bus, persistState: false, autonomy });
  const nar = new NAR(config);

  const original = (bus as { emit: (channel: string, payload: unknown) => void }).emit.bind(bus);
  (bus as { emit: (channel: string, payload: unknown) => void }).emit = (channel, payload) => {
    events.push({ channel, payload });
    original(channel, payload);
  };

  return { nar, events };
};

const start = async (nar: NAR): Promise<void> => {
  await nar.initialize();
  await nar.start();
};

const stop = async (nar: NAR): Promise<void> => {
  await nar.stop();
  await nar.dispose();
};

const channels = (events: readonly Captured[]): string[] => events.map((e) => e.channel);

describe('CORE.19 C5 — autonomy configuration', () => {
  it('is off by default and merges a partial override over the declared defaults', () => {
    expect(DEFAULT_AUTONOMY_CONFIG.enabled).toBe(false);
    expect(DEFAULT_AUTONOMY_CONFIG.mode).toBe('manual');

    const resolved = resolveAutonomyConfig({
      enabled: true,
      mode: 'stepping',
      policies: { curiosity: false },
    });
    expect(resolved.enabled).toBe(true);
    expect(resolved.mode).toBe('stepping');
    // A single-policy override keeps the other switches.
    expect(resolved.policies).toEqual({
      heartbeat: DEFAULT_AUTONOMY_CONFIG.policies.heartbeat,
      curiosity: false,
      consolidation: DEFAULT_AUTONOMY_CONFIG.policies.consolidation,
    });
    expect(AUTONOMY_MODES).toContain(resolved.mode);
  });
});

describe('CORE.19 C5 — kernel heartbeat', () => {
  it('steps exactly one cycle per tick in stepping mode, observable on the bus', async () => {
    const { nar, events } = buildNar({ enabled: true, mode: 'stepping' });
    await start(nar);

    const report = await nar.autonomyTick();
    expect(report?.stepped).toBe(1);
    expect(nar.getCycleCount()).toBe(1);
    expect(events.filter((e) => e.channel === 'cycle:state')).toHaveLength(1);
    const heartbeat = events.find((e) => e.channel === 'cycle:state')!.payload as {
      state: string;
      cycle: number;
    };
    expect(heartbeat.state).toBe('stepping');
    expect(heartbeat.cycle).toBe(nar.getCycleCount());

    await stop(nar);
  });

  it('halts a runaway loop at the window cycle budget and says why', async () => {
    const { nar, events } = buildNar({
      enabled: true,
      mode: 'stepping',
      maxCyclesPerWindow: 1,
      policies: { heartbeat: true, curiosity: false, consolidation: false },
    });
    await start(nar);

    expect((await nar.autonomyTick())?.stepped).toBe(1);
    const second = await nar.autonomyTick();
    expect(second?.stepped).toBe(0);
    expect(second?.halted).toBe('cycle-budget');
    expect(nar.getCycleCount()).toBe(1);
    expect(channels(events)).toContain('autonomy:budget');

    await stop(nar);
  });
});

describe('CORE.19 C5 — curiosity policy', () => {
  it('mints a provenance-carrying question for an uncertain concept', async () => {
    const { nar, events } = buildNar({
      enabled: true,
      mode: 'stepping',
      policies: { heartbeat: true, curiosity: true, consolidation: false },
    });
    await start(nar);
    await nar.believe('(robin --> bird).', Truth.create(0.5, 0.05));

    await nar.autonomyTick();

    const curiosity = events.find((e) => e.channel === 'autonomy:curiosity');
    expect(curiosity).toBeDefined();
    const payload = curiosity!.payload as {
      policy: string;
      trigger: string;
      concept: string;
      question: string;
      cycle: number;
    };
    expect(payload.policy).toBe('curiosity');
    expect(payload.trigger).toBe('idle-scan');
    expect(payload.question).toBe(`${payload.concept}?`);
    expect(payload.cycle).toBe(nar.getCycleCount());

    // The question admitted through the one gate, joined by the autonomy correlation.
    const admitted = nar.gates
      .getPerceptionGate()
      .getEventLog()
      .some((e) => e.type === 'task.admitted' && e.correlationId === `autonomy:curiosity:${payload.concept}`);
    expect(admitted).toBe(true);

    await stop(nar);
  });

  it('has an off switch and respects store backpressure', async () => {
    const off = buildNar({
      enabled: true,
      mode: 'stepping',
      policies: { heartbeat: true, curiosity: false, consolidation: false },
    });
    await start(off.nar);
    await off.nar.believe('(a --> b).', Truth.create(0.5, 0.01));
    await off.nar.autonomyTick();
    expect(channels(off.events)).not.toContain('autonomy:curiosity');
    await stop(off.nar);

    const suppressed = buildNar({
      enabled: true,
      mode: 'stepping',
      backpressureThreshold: 0,
      policies: { heartbeat: true, curiosity: true, consolidation: false },
    });
    await start(suppressed.nar);
    await suppressed.nar.believe('(a --> b).', Truth.create(0.5, 0.01));
    await suppressed.nar.autonomyTick();
    expect(channels(suppressed.events)).not.toContain('autonomy:curiosity');
    await stop(suppressed.nar);
  });
});

describe('CORE.19 C5 — consolidation policy', () => {
  it('runs the single sweep on its interval and reports the delta', async () => {
    const { nar, events } = buildNar({
      enabled: true,
      mode: 'stepping',
      consolidation: { intervalCycles: 1 },
      policies: { heartbeat: true, curiosity: false, consolidation: true },
    });
    await start(nar);
    await nar.believe('(a --> b).', Truth.create(0.9, 0.9));

    await nar.autonomyTick();

    const consolidated = events.find((e) => e.channel === 'autonomy:consolidated');
    expect(consolidated).toBeDefined();
    const payload = consolidated!.payload as {
      policy: string;
      conceptsBefore: number;
      conceptsAfter: number;
      cycle: number;
    };
    expect(payload.policy).toBe('consolidation');
    expect(payload.cycle).toBe(nar.getCycleCount());
    expect(typeof payload.conceptsBefore).toBe('number');
    expect(typeof payload.conceptsAfter).toBe('number');

    await stop(nar);
  });
});

describe('CORE.19 C5 — honesty', () => {
  it('reports autonomyLoop from configuration, not a constant', async () => {
    const enabled = buildNar({ enabled: true, mode: 'stepping' });
    expect(enabled.nar.isAutonomyEnabled()).toBe(true);
    expect(AUTONOMY_POLICIES).toContain('heartbeat');

    const disabled = buildNar({});
    expect(disabled.nar.isAutonomyEnabled()).toBe(false);
  });
});

describe('CORE.19 C5.5 — consolidation is recoverable from its pre-pass checkpoint', () => {
  it('restores the exact pre-pass graph when the last pass is undone', async () => {
    const { nar } = buildNar({ enabled: true, mode: 'stepping' });
    await start(nar);
    await nar.believe('(cat --> animal).', Truth.create(0.9, 0.9));
    const sizeBefore = nar.memory.size;
    expect(sizeBefore).toBeGreaterThan(0);

    nar.checkpointConsolidation(nar.getCycleCount());
    nar.clearMemory();
    expect(nar.memory.size).toBe(0);

    const report = await nar.recoverConsolidation();
    expect(report?.checkpointed).toBe(true);
    expect(nar.memory.size).toBe(sizeBefore);

    await stop(nar);
  });

  it('captures a checkpoint on the pass and reports nothing to recover before one runs', async () => {
    const fresh = buildNar({ enabled: false, mode: 'manual' });
    await start(fresh.nar);
    expect(await fresh.nar.recoverConsolidation()).toBeNull();
    await stop(fresh.nar);

    const { nar, events } = buildNar({
      enabled: true,
      mode: 'stepping',
      consolidation: { intervalCycles: 1 },
      policies: { heartbeat: true, curiosity: false, consolidation: true },
    });
    await start(nar);
    await nar.believe('(a --> b).', Truth.create(0.9, 0.9));

    await nar.autonomyTick();

    const consolidated = events.find((e) => e.channel === 'autonomy:consolidated');
    expect((consolidated!.payload as { checkpointed: boolean }).checkpointed).toBe(true);
    expect(await nar.recoverConsolidation()).not.toBeNull();

    await stop(nar);
  });
});
