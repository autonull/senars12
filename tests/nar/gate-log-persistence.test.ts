import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GateRegistry } from '@senars/kernel';
import { replayTaskAdmissions } from '@senars/log';
import { createLogStore } from '../../src/log/store';
import { createLogStoreGateEventLedger } from '../../src/log/GateEventLedger';
import type { LogStore } from '../../src/log/store';

describe('todo7: gate log persistence (LogStoreGateEventLedger)', () => {
  let logStore: LogStore;
  let ledger: ReturnType<typeof createLogStoreGateEventLedger>;
  let stateDir: string;

  beforeEach(async () => {
    stateDir = mkdtempSync(join(tmpdir(), 'gate-log-'));
    logStore = createLogStore({ dir: join(stateDir, 'log') });
    await logStore.open();
    ledger = createLogStoreGateEventLedger(logStore);
  });

  afterEach(async () => {
    await logStore.close();
  });

  it('persists, reloads, and replays admissions in order', async () => {
    const registry = new GateRegistry();
    await registry.getPerceptionGate().admit({
      sourceId: 's',
      rawObservation: '(a-->b).',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    await registry.getPerceptionGate().admit({
      sourceId: 's',
      rawObservation: '(c-->d).',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    await registry.getActionGate().requestModeChange('propose-only', 'system');

    const appended = await ledger.flush(registry);
    expect(appended).toBe(3);

    const events = await ledger.read();
    expect(events).toHaveLength(3);
    const admissions = replayTaskAdmissions(events);
    expect(admissions.map((a) => a.term)).toEqual(['(a-->b)', '(c-->d)']);
    expect(events.some((e) => e.type === 'autonomy.mode.changed')).toBe(true);
  });

  it('empty log returns empty events', async () => {
    const events = await ledger.read();
    expect(events).toEqual([]);
  });

  it('empty registry appends nothing', async () => {
    const fresh = new GateRegistry();
    const appended = await ledger.flush(fresh);
    expect(appended).toBe(0);

    const events = await ledger.read();
    expect(events).toEqual([]);
  });

  it('replayInto restores events into registry rings', async () => {
    const registry = new GateRegistry();
    await registry.getPerceptionGate().admit({
      sourceId: 's',
      rawObservation: '(a-->b).',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    await ledger.flush(registry);

    // Create new registry and replay
    const registry2 = new GateRegistry();
    const restored = await ledger.replayInto(registry2);
    expect(restored).toBe(1);

    const perceptionLog = registry2.getPerceptionGate().getEventLog();
    expect(perceptionLog).toHaveLength(1);
    expect(perceptionLog[0]?.payload.term).toBe('(a-->b)');
  });

  it('does not re-append already-seen events on flush', async () => {
    const registry = new GateRegistry();
    await registry.getPerceptionGate().admit({
      sourceId: 's',
      rawObservation: '(a-->b).',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });

    const firstFlush = await ledger.flush(registry);
    expect(firstFlush).toBe(1);

    const secondFlush = await ledger.flush(registry);
    expect(secondFlush).toBe(0);

    const events = await ledger.read();
    expect(events).toHaveLength(1);
  });

  it('readWithGate returns events with their originating gate', async () => {
    const registry = new GateRegistry();
    await registry.getPerceptionGate().admit({
      sourceId: 's',
      rawObservation: '(a-->b).',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    await registry.getActionGate().requestModeChange('propose-only', 'system');

    await ledger.flush(registry);

    const results = await ledger.readWithGate();
    expect(results).toHaveLength(2);

    const perceptionEvents = results.filter((r) => r.gate === 'perception');
    const autonomyEvents = results.filter((r) => r.gate === 'autonomy');
    expect(perceptionEvents).toHaveLength(1);
    expect(autonomyEvents).toHaveLength(1);
  });
});