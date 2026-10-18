import { SeededRNG, sequentialIdSource, stableStringify } from '@senars/util';
import { describe, expect, it } from 'vitest';
import type { NARConfig } from '@senars/nar/facade/config.js';
import { NAR } from '@senars/nar/nar.js';
import { NarEventBus } from '@senars/nar/types/events.js';
import { e2eNARConfig } from '../e2e/fixtures.js';

/**
 * CORE.19 M0 — kernel heartbeat proof.
 *
 * The smallest backend-observed proof the substrate is real: a kernel-owned step
 * advances exactly one cycle, the cycle is announced on the single stream, a rule
 * fire is recorded and queryable, and two seeded runs are byte-identical with ids
 * (timestamps the only exemption, D13).
 */

const SEED = 42;

interface Captured {
  channel: string;
  payload: unknown;
}

const buildNar = (): { nar: NAR; bus: NarEventBus; events: Captured[] } => {
  const bus = new NarEventBus();
  const events: Captured[] = [];
  const rng = new SeededRNG(SEED);
  const config: NARConfig = e2eNARConfig({
    eventBus: bus,
    rng: () => rng.next(),
    ids: sequentialIdSource(),
    persistState: false,
  });
  const nar = new NAR(config);

  const original = (bus as { emit: (channel: string, payload: unknown) => void }).emit.bind(bus);
  (bus as { emit: (channel: string, payload: unknown) => void }).emit = (channel, payload) => {
    events.push({ channel, payload });
    original(channel, payload);
  };

  return { nar, bus, events };
};

/** Strip the wall-clock exemption and the term internals from a captured stream (D13). */
const stripTimestamps = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripTimestamps);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== 'timestamp')
        .map(([key, v]) => [key, stripTimestamps(v)])
    );
  }
  return value;
};

const normalize = (events: readonly Captured[]): string =>
  stableStringify(
    events.map(({ channel, payload }) => {
      const p = payload as Record<string, unknown>;
      switch (channel) {
        case 'cycle:state':
          return {
            channel,
            state: p.state,
            cycle: p.cycle,
            phase: p.phase,
            activeTasks: p.activeTasks,
            derived: p.derived,
            budget: p.budget,
          };
        case 'rule:applied':
          return {
            channel,
            ruleId: p.ruleId,
            premises: (p.premises as Array<{ toString(): string }>).map(String),
            conclusion: String(p.conclusion),
            truth: p.truth,
            cycle: p.cycle,
          };
        default:
          return { channel, payload: stripTimestamps(p) };
      }
    })
  );

const runM0 = async (): Promise<{ nar: NAR; events: Captured[] }> => {
  const { nar, events } = buildNar();
  await nar.initialize();
  await nar.start();

  await nar.input('(a --> b).');
  await nar.input('(b --> c).');
  await nar.step();

  return { nar, events };
};

describe('CORE.19 M0 — kernel heartbeat proof', () => {
  it('steps exactly one cycle and reports the kernel count on cycle.state', async () => {
    const { nar, events } = await runM0();

    expect(nar.getCycleCount()).toBe(1);

    const heartbeats = events.filter((e) => e.channel === 'cycle:state');
    expect(heartbeats).toHaveLength(1);
    const state = heartbeats[0]!.payload as {
      state: string;
      cycle: number;
      phase: string;
      budget: Record<string, number>;
    };
    expect(state.cycle).toBe(nar.getCycleCount());
    expect(state.state).toBe('stepping');
    expect(state.phase).toBe('idle');
    expect(typeof state.budget).toBe('object');

    await nar.stop();
    await nar.dispose();
  });

  it('records a queryable rule fire carrying its cycle', async () => {
    const { nar } = await runM0();

    const fires = nar.getRuleFires();
    expect(fires.length).toBeGreaterThan(0);
    const fire = fires[0]!;
    expect(fire.ruleId).toBeTruthy();
    expect(fire.premises).toHaveLength(2);
    expect(fire.conclusion).toBeTruthy();
    expect(fire.truth).toBeDefined();
    expect(fire.cycle).toBe(1);
    expect(typeof fire.timestamp).toBe('number');

    expect(nar.getRuleFiresByCycle(1).length).toBeGreaterThan(0);
    expect(nar.getRuleFiresByCycle(1)[0]!.stepId).toBe(fire.stepId);

    await nar.stop();
    await nar.dispose();
  });

  it('flows the cycle event and the rule fire through the one stream', async () => {
    const { nar, events } = await runM0();

    expect(events.some((e) => e.channel === 'cycle:state')).toBe(true);
    expect(events.some((e) => e.channel === 'rule:applied')).toBe(true);

    await nar.stop();
    await nar.dispose();
  });

  it('produces byte-identical streams across two seeded runs', async () => {
    const first = await runM0();
    const second = await runM0();

    expect(normalize(second.events)).toBe(normalize(first.events));

    const fires = (nar: NAR): string =>
      stableStringify(
        nar.getRuleFires().map(({ timestamp: _ts, ...rest }) => rest)
      );
    expect(fires(second.nar)).toBe(fires(first.nar));

    await first.nar.stop();
    await first.nar.dispose();
    await second.nar.stop();
    await second.nar.dispose();
  });
});

describe('CORE.19 C2 — kernel control plane', () => {
  it('counts one cycle per step, pauses, and resumes', async () => {
    const { nar } = buildNar();
    await nar.initialize();
    await nar.start();

    await nar.input('(a --> b).');
    await nar.step();
    expect(nar.getCycleCount()).toBe(1);
    expect(nar.getControlState()).toBe('running');

    nar.pause();
    expect(nar.getControlState()).toBe('paused');
    expect(await nar.run(1)).toBe(0);
    expect(nar.getCycleCount()).toBe(1);

    nar.resume();
    await nar.step();
    expect(nar.getCycleCount()).toBe(2);

    await nar.stop();
    await nar.dispose();
  });

  it('accepts the cycle control messages on the client protocol', async () => {
    const { IncomingFromClient } = await import('@senars/core/protocol');
    for (const message of [
      { type: 'cycle.step' },
      { type: 'cycle.pause' },
      { type: 'cycle.resume' },
      { type: 'cycle.rewind', cycles: 3 },
    ]) {
      expect(IncomingFromClient.safeParse(message).success).toBe(true);
    }
  });
});
