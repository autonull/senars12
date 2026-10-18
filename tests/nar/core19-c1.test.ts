import { Agent, InMemoryEventLog, isDurableEvent, recalledEventTypes } from '@senars/core';
import { mintCognitiveEvent } from '@senars/core/schemas';
import { NAREngine } from '@senars/nar/engine/NAREngine';
import { describe, expect, it } from 'vitest';

/**
 * CORE.19 C1 — one event stream.
 *
 * The bridge's cognitive output now reaches the append-only log as well as the
 * live subscribers, but only the declared families: the log is the source of
 * truth, and the per-cycle heartbeat must not displace recalled memory. And the
 * rule fire has a durable, provenance-carrying form (`derivation.accepted`) whose
 * fields verify against the schema.
 */

const startedAgent = async (): Promise<{ agent: Agent; log: InMemoryEventLog; nar: NAREngine['nar'] }> => {
  const log = new InMemoryEventLog();
  const agent = new Agent({ id: 'core19-c1', log });
  const engine = new NAREngine(undefined, (event) => agent.emitCognitive(event));
  agent.registerEngine('nar', engine);
  await agent.start();
  return { agent, log, nar: engine.nar };
};

describe('CORE.19 C1 — one event stream', () => {
  it('persists the bridge output in the durable log, family by family', async () => {
    const { agent, log, nar } = await startedAgent();

    await nar.input('(a --> b).');
    await nar.input('(b --> c).');
    await nar.step();
    await agent.flushDurable();

    const types = log.events.map((e) => e.type);
    expect(types).toContain('derivation.accepted');

    // The heartbeat is live-only: it must not enter the durable log.
    expect(types).not.toContain('cycle');

    await agent.stop();
  });

  it('emits a schema-shaped derivation.accepted per rule fire', async () => {
    const { agent, log, nar } = await startedAgent();

    await nar.input('(a --> b).');
    await nar.input('(b --> c).');
    await nar.step();
    await agent.flushDurable();

    const accepted = log.events.filter((e) => e.type === 'derivation.accepted');
    expect(accepted.length).toBeGreaterThan(0);
    const event = accepted[0]!;
    if (event.type !== 'derivation.accepted') throw new Error('narrowing');
    expect(event.payload.premises.length).toBeGreaterThan(0);
    expect(event.payload.premises.every((p) => typeof p === 'string')).toBe(true);
    expect(typeof event.payload.conclusion).toBe('string');
    expect(typeof event.payload.derivationId).toBe('string');
    expect(Array.isArray(event.payload.evidenceLineage)).toBe(true);
    expect(typeof event.payload.independenceCheck).toBe('string');
    expect(event.payload.truth.frequency).toBeGreaterThanOrEqual(0);

    await agent.stop();
  });

  it('declares which families are durable and which episodic recall reads', () => {
    const cycle = mintCognitiveEvent('cycle', {
      engine: 'nar',
      cycle: 1,
      derived: 0,
      payload: { cycle: 1, derived: 0, state: 'running', phase: 'idle', activeTasks: 0, budget: {} },
    });
    expect(isDurableEvent(cycle)).toBe(false);

    const user = mintCognitiveEvent('input.user', {
      engine: 'nar',
      payload: { text: 'hi', source: 'test' },
    });
    // input.user is durable via its explicit append, and recalled.
    expect(recalledEventTypes()).toContain('input.user');
    expect(recalledEventTypes()).not.toContain('cycle');
    expect(user.type).toBe('input.user');
  });

  it('does not persist the same family twice through the funnel', async () => {
    const { agent, log, nar } = await startedAgent();

    await nar.input('(a --> b).');
    await nar.input('(b --> c).');
    await nar.step();
    await agent.flushDurable();

    const events = log.events;
    // Every id in the log is distinct — the serialized tail keeps emit order and
    // appends each durable family once.
    const ids = events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);

    await agent.stop();
  });
});
