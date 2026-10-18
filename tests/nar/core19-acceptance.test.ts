/**
 * CORE.19 §8 — acceptance walkthrough (definition of done).
 *
 * One continuous headless session, no browser, no LM configured (D10): Narsese in
 * through the one gate, a kernel-owned step that advances the heartbeat on the one
 * stream, an answer carrying its derivation, an explanation that cites real rule-fire
 * records, a flagged contradiction, and a kill-and-restart that resumes the declared
 * boundary and announces it. The same round-trip is reachable through the CLI one-shot
 * and MCP, and two seeded runs are byte-identical with ids (timestamps the exemption, D13).
 *
 * The per-workstream suites assert the details; this asserts the pieces compose.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { SeededRNG, sequentialIdSource, stableStringify } from '@senars/util';
import { createNAR, Truth } from '@senars/nar';
import type { NARConfig } from '@senars/nar/facade/config.js';
import { NAR } from '@senars/nar/nar.js';
import { NarEventBus } from '@senars/nar/types/events.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runOneShot } from '../../src/bin/lib/oneshot.js';
import { registerMCPResources } from '../../src/bin/lib/mcp/mcp-resources.js';
import { e2eNARConfig } from '../e2e/fixtures.js';

interface Captured {
  channel: string;
  payload: unknown;
}

const capture = (bus: NarEventBus, events: Captured[]): void => {
  const original = (bus as { emit: (channel: string, payload: unknown) => void }).emit.bind(bus);
  (bus as { emit: (channel: string, payload: unknown) => void }).emit = (channel, payload) => {
    events.push({ channel, payload });
    original(channel, payload);
  };
};

/** Strip the declared wall-clock exemption from a captured stream (D13). */
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
  stableStringify(events.map(({ channel, payload }) => ({ channel, payload: stripTimestamps(payload) })));

const stateDir = join(process.cwd(), '.cache', 'test-core19-acceptance');

describe('CORE.19 §8 — acceptance walkthrough', () => {
  const stopped: Array<{ stop(): Promise<void>; dispose(): Promise<void> }> = [];

  beforeEach(async () => {
    await rm(stateDir, { recursive: true, force: true });
    await mkdir(stateDir, { recursive: true });
  });

  afterEach(async () => {
    for (const nar of stopped.splice(0)) await nar.dispose();
    await rm(stateDir, { recursive: true, force: true });
  });

  it('runs one continuous headless session: believe, step, ask, explain, flag a contradiction, restart', async () => {
    const bus = new NarEventBus();
    const events: Captured[] = [];
    const nar = new NAR(
      e2eNARConfig({ eventBus: bus, persistState: true, statePath: stateDir })
    );
    stopped.push(nar);
    capture(bus, events);
    await nar.initialize();
    await nar.start();

    // Step 3/7 — Narsese in through the one gate with no LM; a non-Narsese
    // utterance is *declared* rejected, never a silent no-op (D15).
    const admitted = await nar.perceive('(cat --> animal).');
    expect(admitted.rejected).toEqual([]);
    expect(admitted.admitted.map((a) => a.source)).toEqual(['user']);
    await nar.perceive('(animal --> living).');
    const rejected = await nar.perceive('cats are animals');
    expect(rejected.admitted).toEqual([]);
    expect(rejected.rejected[0]?.reason).toMatch(/not Narsese/);

    // Step 1 — a kernel-owned step advances exactly one cycle and announces it on the one stream.
    await nar.step();
    expect(nar.getCycleCount()).toBe(1);
    const heartbeats = events.filter((e) => e.channel === 'cycle:state');
    expect(heartbeats).toHaveLength(1);
    expect((heartbeats[0]!.payload as { cycle: number }).cycle).toBe(1);

    // A queryable rule fire, carrying its cycle, on the same stream.
    await nar.run(3);
    const fires = nar.getRuleFires();
    expect(fires.length).toBeGreaterThan(0);
    expect(nar.getRuleFiresByCycle(fires[0]!.cycle!).length).toBeGreaterThan(0);
    expect(events.some((e) => e.channel === 'rule:applied')).toBe(true);

    // Step 5 — an answer with its verified derivation, and an explanation that cites
    // real, resolvable rule-fire records.
    const answer = await nar.askWithDerivation('(cat --> living)?');
    expect(answer.answer).toBeTruthy();
    expect(answer.derivation?.record.steps.length ?? 0).toBeGreaterThan(0);

    const conclusion = fires[fires.length - 1]!.conclusion;
    const explanation = await nar.explainDerivation(conclusion);
    expect(explanation.steps).toBeGreaterThan(0);
    expect(explanation.derivationIds).toHaveLength(explanation.steps);
    for (const id of explanation.derivationIds) expect(nar.getRuleFireById(id)).toBeDefined();
    expect(events.some((e) => e.channel === 'explanation')).toBe(true);

    // Step 5 — a coexisting contradiction is flagged with a cited explanation.
    await nar.input('--(cat --> living).');
    const pairs = nar.findContradictions();
    expect(pairs).toHaveLength(1);
    const conflict = await nar.explainConflict(pairs[0]!.a, pairs[0]!.b);
    expect(conflict.narrative).toMatch(/Conflict:/);
    expect(conflict.sides).toHaveLength(2);

    // Step 6 — kill and restart resumes the declared boundary and announces it.
    const cycles = nar.getCycleCount();
    await nar.stop();
    await nar.dispose();
    stopped.length = 0;

    const bus2 = new NarEventBus();
    const restored: Array<{ cycleCount: number; concepts: number; pendingTasks: number }> = [];
    bus2.on('restore:state', (event) => restored.push(event));
    const resumed = new NAR(e2eNARConfig({ eventBus: bus2, persistState: true, statePath: stateDir }));
    stopped.push(resumed);
    await resumed.start();

    expect(resumed.getCycleCount()).toBe(cycles);
    expect(resumed.getBeliefs().length).toBeGreaterThan(0);
    expect(restored).toHaveLength(1);
    expect(restored[0]!.cycleCount).toBe(cycles);
  });

  it('produces byte-identical streams across two seeded runs (ids included)', async () => {
    const runSeeded = async (): Promise<Captured[]> => {
      const bus = new NarEventBus();
      const events: Captured[] = [];
      const rng = new SeededRNG(42);
      const config: NARConfig = e2eNARConfig({
        eventBus: bus,
        persistState: false,
        rng: () => rng.next(),
        ids: sequentialIdSource(),
      });
      const nar = new NAR(config);
      stopped.push(nar);
      capture(bus, events);
      await nar.initialize();
      await nar.start();
      await nar.input('(a --> b).');
      await nar.input('(b --> c).');
      await nar.step();
      await nar.run(3);
      await nar.stop();
      return events;
    };

    expect(normalize(await runSeeded())).toBe(normalize(await runSeeded()));
  });

  it('thinks unasked in stepping mode, then halts at its budget', async () => {
    const bus = new NarEventBus();
    const events: Captured[] = [];
    const nar = new NAR(
      e2eNARConfig({
        eventBus: bus,
        persistState: false,
        autonomy: {
          enabled: true,
          mode: 'stepping',
          consolidation: { intervalCycles: 1 },
          policies: { heartbeat: true, curiosity: true, consolidation: true },
        },
      })
    );
    stopped.push(nar);
    capture(bus, events);
    await nar.initialize();
    await nar.start();
    expect(nar.isAutonomyEnabled()).toBe(true);

    await nar.believe('(robin --> bird).', Truth.create(0.5, 0.05));
    await nar.autonomyTick();

    const channels = events.map((e) => e.channel);
    expect(channels).toContain('cycle:state');
    expect(channels).toContain('autonomy:curiosity');
    expect(channels).toContain('autonomy:consolidated');

    const halted = new NAR(
      e2eNARConfig({
        persistState: false,
        autonomy: {
          enabled: true,
          mode: 'stepping',
          maxCyclesPerWindow: 1,
          policies: { heartbeat: true, curiosity: false, consolidation: false },
        },
      })
    );
    stopped.push(halted);
    await halted.initialize();
    await halted.start();
    expect((await halted.autonomyTick())?.stepped).toBe(1);
    expect((await halted.autonomyTick())?.halted).toBe('cycle-budget');
    expect(halted.getCycleCount()).toBe(1);
  });

  it('reaches the same round-trip with no browser, via the CLI one-shot and MCP', async () => {
    const lines: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((...args) => lines.push(args.join(' ')));
    try {
      const result = await runOneShot({
        inputs: ['(cat-->animal).', '(animal-->living).', '(cat-->living)?'],
        steps: 10,
        json: false,
      });
      expect(result.answers).toHaveLength(1);
      expect(result.answers[0]!.answer).toBeTruthy();
      expect(result.answers[0]!.derivation?.length ?? 0).toBeGreaterThan(0);
      expect(lines.join('\n')).toContain('nal.deduction');
    } finally {
      log.mockRestore();
    }

    const nar = createNAR({ enableSelf: true, persistState: false });
    stopped.push(nar);
    await nar.start();
    await nar.believe('(cat-->animal).');
    await nar.run(3);

    const server = new McpServer({ name: 'acceptance', version: '0.0.1' });
    registerMCPResources(server, { nar });
    const client = new Client({ name: 'acceptance-client', version: '0.0.1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const { contents } = await client.readResource({ uri: 'nar://state' });
    const content = contents[0]!;
    const state = JSON.parse('text' in content ? content.text : '{}') as {
      beliefs?: unknown[];
      persisted?: unknown;
    };
    expect((state.beliefs ?? []).length).toBeGreaterThan(0);
    expect('persisted' in state).toBe(true);

    await client.close();
  });
});
