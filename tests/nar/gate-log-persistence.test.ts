import { appendFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GateRegistry } from '../../nar/src/kernel/GateRegistry.js';
import { loadGateEvents, persistGateLogs, replayTaskAdmissions } from '../../nar/src/kernel/EventLogPersistence.js';

describe('todo7: gate log persistence', () => {
  it('persists, reloads, and replays admissions in order', () => {
    const registry = new GateRegistry();
    registry.getPerceptionGate().admit({ sourceId: 's', rawObservation: '(a --> b).', sensorConfidence: 1, sourceQuality: 'PRIMARY' });
    registry.getPerceptionGate().admit({ sourceId: 's', rawObservation: '(c --> d).', sensorConfidence: 1, sourceQuality: 'PRIMARY' });
    registry.getActionGate().requestModeChange('propose-only', 'system');
    const path = join(mkdtempSync(join(tmpdir(), 'gate-log-')), 'events.jsonl');
    expect(persistGateLogs(registry, path).appended).toBe(3);
    const { events, invalid } = loadGateEvents(path);
    expect(invalid).toBe(0);
    expect(events).toHaveLength(3);
    const admissions = replayTaskAdmissions(events);
    expect(admissions.map((a) => a.term)).toEqual(['(a --> b)', '(c --> d)']);
    expect(events.some((e) => e.type === 'autonomy.mode.changed')).toBe(true);
  });
  it('missing file loads empty; corrupt lines counted not thrown', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gate-log-'));
    expect(loadGateEvents(join(dir, 'nope.jsonl'))).toEqual({ events: [], invalid: 0 });
    const path = join(dir, 'bad.jsonl');
    appendFileSync(path, 'not json\n{"type":"nope"}\n');
    const fresh = new GateRegistry();
    fresh.getPerceptionGate().admit({ sourceId: 's', rawObservation: '(a --> b).', sensorConfidence: 1, sourceQuality: 'PRIMARY' });
    persistGateLogs(fresh, path);
    const { events, invalid } = loadGateEvents(path);
    expect(events).toHaveLength(1);
    expect(invalid).toBe(2);
  });
  it('empty registry appends nothing', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'gate-log-')), 'e.jsonl');
    expect(persistGateLogs(new GateRegistry(), path).appended).toBe(0);
    expect(loadGateEvents(path)).toEqual({ events: [], invalid: 0 });
  });
});
