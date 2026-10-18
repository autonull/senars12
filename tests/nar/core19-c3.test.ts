import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyRecord } from '@senars/core/verify-derivation';
import { SeededRNG, sequentialIdSource } from '@senars/util';
import { describe, expect, it } from 'vitest';
import type { NARConfig } from '@senars/nar/facade/config.js';
import { NAR } from '@senars/nar/nar.js';
import { NarEventBus } from '@senars/nar/types/events.js';
import { e2eNARConfig } from '../e2e/fixtures.js';

/**
 * CORE.19 C3 — gate observation & provenance records.
 *
 * Every inference-rule application is a queryable fire record (by id, cycle,
 * concept and conclusion), carrying the run's correlation so it joins the one
 * stream. A seeded derivation verifies under the standalone truth algebra. And
 * the gate rings are durable at runtime through a rotating ledger, not only in a
 * fixture.
 */

const SEED = 42;

const buildNar = (overrides: Partial<NARConfig> = {}): { nar: NAR; bus: NarEventBus } => {
  const bus = new NarEventBus();
  const rng = new SeededRNG(SEED);
  return {
    bus,
    nar: new NAR(
      e2eNARConfig({
        eventBus: bus,
        rng: () => rng.next(),
        ids: sequentialIdSource(),
        persistState: false,
        ...overrides,
      })
    ),
  };
};

const runSyllogism = async (nar: NAR, correlationId?: string): Promise<void> => {
  await nar.input('(a --> b).');
  await nar.input('(b --> c).');
  await nar.step(undefined, correlationId);
};

describe('CORE.19 C3 — gate observation & provenance records', () => {
  it('stamps the run correlation on each fire and joins it to the durable event', async () => {
    const { nar, bus } = buildNar();
    const accepted: Array<Record<string, unknown>> = [];
    bus.on('derivation:accepted', (payload) =>
      accepted.push(payload as unknown as Record<string, unknown>)
    );
    await nar.initialize();
    await nar.start();

    await runSyllogism(nar, 'corr-c3');

    const fires = nar.getRuleFires();
    expect(fires.length).toBeGreaterThan(0);
    expect(fires[0]!.correlationId).toBe('corr-c3');
    expect(accepted.length).toBeGreaterThan(0);
    expect(accepted[0]!.correlationId).toBe('corr-c3');
    expect(accepted[0]!.ruleCategory).toBeTruthy();

    await nar.stop();
    await nar.dispose();
  });

  it('queries a fire by id, cycle and conclusion', async () => {
    const { nar } = buildNar();
    await nar.initialize();
    await nar.start();

    await runSyllogism(nar);

    const fire = nar.getRuleFires()[0]!;
    expect(nar.getRuleFireById(fire.stepId)).toEqual(fire);
    expect(nar.getRuleFiresByCycle(1).map((f) => f.stepId)).toContain(fire.stepId);
    expect(nar.getRuleFiresByConclusion(fire.conclusion).map((f) => f.stepId)).toContain(
      fire.stepId
    );

    await nar.stop();
    await nar.dispose();
  });

  it('yields a seeded derivation whose truth algebra verifies', async () => {
    const { nar } = buildNar();
    await nar.initialize();
    await nar.start();

    await runSyllogism(nar);
    await nar.run(5);

    const records = nar.getProcessor().getRecorder().drain();
    expect(records.length).toBeGreaterThan(0);
    let verified = 0;
    for (const record of records) {
      const result = verifyRecord(record);
      expect(result.errors).toEqual([]);
      verified += result.truthVerified;
    }
    expect(verified).toBeGreaterThan(0);

    await nar.stop();
    await nar.dispose();
  });

  it('persists the gate rings to a rotating ledger at runtime', async () => {
    const statePath = mkdtempSync(join(tmpdir(), 'core19-c3-'));
    const { nar } = buildNar({ persistState: true, statePath });
    await nar.initialize();
    await nar.start();

    nar.gates.getPerceptionGate().admit({
      sourceId: 's',
      rawObservation: '(a-->b).',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    nar.gates.getActionGate().requestModeChange('propose-only', 'system');

    const flushed = nar.flushGateLogs();
    expect(flushed).toBeGreaterThanOrEqual(2);
    // Nothing new since the last flush — the cursor is identity-based, not a re-append.
    expect(nar.flushGateLogs()).toBe(0);

    const types = new Set((await nar.getGateEventLedger()!.read()).map((e) => e.type));
    expect(types.has('task.admitted')).toBe(true);
    expect(types.has('autonomy.mode.changed')).toBe(true);

    await nar.stop();
    await nar.dispose();
  });
});
