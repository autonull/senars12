import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { GateRegistry } from '../../nar/src/kernel/GateRegistry.js';
import { loadGateEvents, persistGateLogs, replayCognitiveState, SNAPSHOT_VERSION } from '../../nar/src/kernel/EventLogPersistence.js';
import { validateCognitiveEvent } from '@senars/kernel/schemas';

const driveAllGates = (): GateRegistry => {
    const registry = new GateRegistry();
    registry.getPerceptionGate().admit({ sourceId: 's', rawObservation: '(a --> b).', sensorConfidence: 1, sourceQuality: 'PRIMARY' });
    registry.getRewardGate().process({ eventId: uuidv4(), rewardSignal: 0.5, rewardType: 'extrinsic', targetType: 'truth-confidence', targetId: 'b1' });
    registry.getActionGate().authorize({ proposalId: uuidv4(), operation: 'move', args: {} });
    registry.getActionGate().requestModeChange('propose-only', 'system');
    registry.getBudgetGate().setBudget({ maxCycles: 1, maxDepth: 10, maxMemoryOps: 10, maxLMCalls: 1, consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 } });
    registry.getBudgetGate().check({ operation: 'nal-step' });
    registry.getBudgetGate().check({ operation: 'nal-step' });
    return registry;
};

describe('todo7: cognitive state replay', () => {
  it('pause → serialize → reload → same snapshot, deterministic', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'gate-replay-')), 'events.jsonl');
    persistGateLogs(driveAllGates(), path);
    const { events, invalid } = loadGateEvents(path);
    expect(invalid).toBe(0);
    const first = replayCognitiveState(events);
    expect(first.tasks.map((t) => t.term)).toEqual(['(a --> b)']);
    expect(first.violations).toHaveLength(2);
    expect(first.violations.map((v) => v.policyId).sort()).toEqual(['autonomy-mode', 'epistemic-firewall']);
    expect(first.budgets).toEqual([{ budgetType: 'cycles', terminationReason: 'cycle-budget' }]);
    expect(first.autonomyMode).toBe('propose-only');
    expect(first.beliefs).toEqual({});
    expect(first.derivations).toEqual([]);
    expect(replayCognitiveState(loadGateEvents(path).events)).toEqual(first);
    expect(first.version).toBe(SNAPSHOT_VERSION);
  });

  it('belief revisions retain ordered chain alongside latest truth', () => {
    const mk = (oldTruth: { frequency: number; confidence: number }, newTruth: { frequency: number; confidence: number }) =>
      validateCognitiveEvent({
        type: 'belief.revised', engine: 'kernel', timestamp: Date.now(),
        correlationId: uuidv4(),
        payload: { term: '(a --> b)', oldTruth, newTruth, evidenceLineage: [], revisionRule: 'revision' },
      });
    const events = [mk({ frequency: 0.8, confidence: 0.7 }, { frequency: 0.85, confidence: 0.75 }), mk({ frequency: 0.85, confidence: 0.75 }, { frequency: 0.9, confidence: 0.8 })];
    const snapshot = replayCognitiveState(events);
    expect(snapshot.beliefs['(a --> b)']).toEqual({ frequency: 0.9, confidence: 0.8 });
    expect(snapshot.revisions['(a --> b)']).toHaveLength(2);
    expect(snapshot.revisions['(a --> b)']?.[0]?.newTruth).toEqual({ frequency: 0.85, confidence: 0.75 });
  });
});
