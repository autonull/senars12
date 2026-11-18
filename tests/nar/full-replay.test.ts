import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCognitiveEvent, validateDerivationRecord } from '@senars/agent';
import { v4 as uuidv4 } from 'uuid';
import {
  type CognitiveParameters,
  DEFAULT_COGNITIVE_PARAMETERS,
} from '@senars/config';
import { GateRegistry } from '@senars/kernel';
import {
  replayIntoMemory,
  serializeReplayResult,
} from '@senars/kernel';
import { Memory } from '@senars/memory';
import { termParser } from '@senars/terms';
import { createLogStore } from '../../src/log/store';
import { createLogStoreGateEventLedger } from '../../src/log/GateEventLedger';
import { createLogStoreDerivationLedger } from '../../src/log/DerivationLedger';
import type { LogStore } from '../../src/log/store';
import type { CognitiveEvent, DerivationRecord } from '@senars/core/schemas';

const mkTaskAdmitted = (
  overrides: Partial<{
    term: string;
    taskType: 'belief' | 'goal' | 'question';
    truth: { frequency: number; confidence: number };
    sourceQuality: 'PRIMARY' | 'SECONDARY' | 'GENERAL' | 'TERTIARY' | 'LLM_PRIOR';
  }> = {}
) =>
  validateCognitiveEvent({
    type: 'task.admitted',
    engine: 'nar',
    timestamp: Date.now(),
    correlationId: uuidv4(),
    payload: {
      taskId: uuidv4(),
      term: overrides.term ?? '(a-->b)',
      taskType: overrides.taskType ?? 'belief',
      truth: overrides.truth ?? { frequency: 1.0, confidence: 0.9 },
      source: 'user',
      budget: { priority: 0.5, durability: 0.5, quality: 0.9, cycles: 10, depth: 5 },
    },
    ...overrides,
  });

const mkBeliefRevised = (
  term: string,
  oldTruth: { frequency: number; confidence: number },
  newTruth: { frequency: number; confidence: number }
) =>
  validateCognitiveEvent({
    type: 'belief.revised',
    engine: 'kernel',
    timestamp: Date.now(),
    correlationId: uuidv4(),
    payload: { term, oldTruth, newTruth, evidenceLineage: [], revisionRule: 'revision' },
  });

const mkConceptActivated = (term: string, priority: number) =>
  validateCognitiveEvent({
    type: 'concept.activated',
    engine: 'nar',
    timestamp: Date.now(),
    correlationId: uuidv4(),
    payload: { term, priority, activationSource: 'perception' },
  });

const mkDerivationRecord = (conclusions: string[]): ReturnType<typeof validateDerivationRecord> => {
  const now = Date.now();
  return validateDerivationRecord({
    derivationId: uuidv4(),
    taskId: uuidv4(),
    goalTerm: '(a-->c)',
    timestamp: now,
    engine: 'nar',
    totalCycles: conclusions.length,
    maxDepthReached: 2,
    finalTruth: { frequency: 0.9, confidence: 0.8 },
    steps: conclusions.map((conclusion, i) => ({
      stepId: uuidv4(),
      ruleId: 'deduction',
      ruleCategory: 'logic',
      premises: ['(a-->b)', '(b-->c)'],
      conclusion,
      truth: { frequency: 0.9, confidence: 0.8 },
      premiseTruths: [
        { frequency: 1, confidence: 0.9 },
        { frequency: 1, confidence: 0.9 },
      ],
      evidenceLineage: [],
      independence: 'independent',
    })),
  });
};

describe('todo7: full-state memory replay (LogStore)', () => {
  let logStore: LogStore;
  let gateLedger: ReturnType<typeof createLogStoreGateEventLedger>;
  let derivLedger: ReturnType<typeof createLogStoreDerivationLedger>;
  let stateDir: string;

  beforeEach(async () => {
    stateDir = mkdtempSync(join(tmpdir(), 'full-replay-'));
    logStore = createLogStore({ dir: join(stateDir, 'log') });
    await logStore.open();
    gateLedger = createLogStoreGateEventLedger(logStore);
    derivLedger = createLogStoreDerivationLedger(logStore);
  });

  afterEach(async () => {
    await logStore.close();
  });

  async function flushGates(registry: GateRegistry): Promise<number> {
    return gateLedger.flush(registry);
  }

  async function readGates(): Promise<CognitiveEvent[]> {
    return gateLedger.read();
  }

  async function flushDerivations(records: DerivationRecord[]): Promise<number> {
    let appended = 0;
    for (const record of records) {
      const event: CognitiveEvent = {
        type: 'derivation.record',
        engine: 'nar',
        timestamp: record.timestamp ?? Date.now(),
        correlationId: crypto.randomUUID(),
        causationId: record.derivationId,
        payload: record,
      };
      await logStore.append(event, { ts: event.timestamp });
      appended++;
    }
    return appended;
  }

  async function readDerivations(): Promise<DerivationRecord[]> {
    const events = await derivLedger.readRecords();
    return events.map((e) => e.payload as DerivationRecord);
  }

  async function replayFromLogStore(
    gateEvents: CognitiveEvent[],
    derivationRecords: DerivationRecord[],
    options?: { cognitiveParams?: CognitiveParameters }
  ): Promise<ReturnType<typeof replayIntoMemory>> {
    // Create temp files for the legacy replayIntoMemory (which expects file paths)
    // This is a bridge until we have a pure LogStore-based replay
    const dir = mkdtempSync(join(tmpdir(), 'replay-bridge-'));
    const gatePath = join(dir, 'gate-events.jsonl');
    const derivPath = join(dir, 'derivations.jsonl');

    const { appendJsonl } = await import('@senars/util');
    await appendJsonl(gatePath, gateEvents);
    await appendJsonl(derivPath, derivationRecords);

    return replayIntoMemory({
      gateEventsPath: gatePath,
      derivationRecordsPath: derivPath,
      cognitiveParams: options?.cognitiveParams,
    });
  }

  it('replays gate events + derivation records into Memory with full state', async () => {
    const registry = new GateRegistry();
    registry.getPerceptionGate().admit({
      sourceId: 's',
      rawObservation: '(a-->b).',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    registry.getPerceptionGate().admit({
      sourceId: 's',
      rawObservation: '(b-->c).',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    registry.getRewardGate().process({
      eventId: uuidv4(),
      rewardSignal: 0.5,
      rewardType: 'extrinsic',
      targetType: 'truth-confidence',
      targetId: 'b1',
    });
    registry.getActionGate().requestModeChange('propose-only', 'system');

    await flushGates(registry);

    const records = [mkDerivationRecord(['(a-->c)'])];
    await flushDerivations(records);

    const gateEvents = await readGates();
    const derivationRecords = await readDerivations();

    const result = await replayFromLogStore(gateEvents, derivationRecords);

    expect(result.appliedTasks).toBe(2);
    expect(result.appliedDerivations).toBe(1);
    expect(result.gateSnapshot.tasks).toHaveLength(2);
    expect(result.gateSnapshot.autonomyMode).toBe('propose-only');

    const conceptAtoC = result.memory.getConcept(termParser.parse('(a-->c)'));
    expect(conceptAtoC).toBeDefined();
    expect(conceptAtoC!.getBeliefs()).toHaveLength(1);
    expect(conceptAtoC!.getBeliefs()[0]?.truth).toEqual({ f: 0.9, c: 0.8 });

    const snapshotPath = join(stateDir, 'replay-snapshot.json');
    await serializeReplayResult(result, snapshotPath);
    const snapshot = JSON.parse(require('node:fs').readFileSync(snapshotPath, 'utf8'));
    expect(snapshot.stats.appliedTasks).toBe(2);
    expect(snapshot.stats.appliedDerivations).toBe(1);
  });

  it('replays belief revisions with evidence lineage', async () => {
    const registry = new GateRegistry();
    registry.getPerceptionGate().admit({
      sourceId: 's',
      rawObservation: '(a-->b).',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    await flushGates(registry);

    const gateEvents = await readGates();
    const rev = mkBeliefRevised(
      '(a-->b)',
      { frequency: 0.8, confidence: 0.7 },
      { frequency: 0.9, confidence: 0.85 }
    );
    const allGateEvents = [...gateEvents, rev];

    const result = await replayFromLogStore(allGateEvents, []);

    expect(result.appliedRevisions).toBe(1);
    const concept = result.memory.getConcept(termParser.parse('(a-->b)'));
    expect(concept).toBeDefined();
    const beliefs = concept!.getBeliefs();
    expect(beliefs).toHaveLength(1);
    expect(beliefs[0]?.truth).toEqual({ f: 0.9, c: 0.85 });
  });

  it('replays concept activations (priority)', async () => {
    const registry = new GateRegistry();
    registry.getPerceptionGate().admit({
      sourceId: 's',
      rawObservation: '(a-->b).',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    await flushGates(registry);

    const gateEvents = await readGates();
    const act = mkConceptActivated('(a-->b)', 0.75);
    const allGateEvents = [...gateEvents, act];

    const result = await replayFromLogStore(allGateEvents, []);

    expect(result.appliedActivations).toBe(1);
    const concept = result.memory.getConcept(termParser.parse('(a-->b)'));
    expect(concept).toBeDefined();
    expect(concept!.priority).toBeCloseTo(0.75, 2);
  });

  it('pause → serialize → replay in separate process yields same state', async () => {
    const registry = new GateRegistry();
    registry.getPerceptionGate().admit({
      sourceId: 's',
      rawObservation: '(a-->b).',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    registry.getPerceptionGate().admit({
      sourceId: 's',
      rawObservation: '(b-->c).',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    registry.getActionGate().requestModeChange('sandbox-execute', 'system');
    registry.getBudgetGate().setBudget({
      maxCycles: 2,
      maxDepth: 10,
      maxMemoryOps: 10,
      maxLMCalls: 1,
      consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
    });
    registry.getBudgetGate().check({ operation: 'nal-step' });
    registry.getBudgetGate().check({ operation: 'nal-step' });
    await flushGates(registry);

    const records = [mkDerivationRecord(['(a-->c)'])];
    await flushDerivations(records);

    const gateEvents = await readGates();
    const derivationRecords = await readDerivations();

    const result1 = await replayFromLogStore(gateEvents, derivationRecords);
    const snapshotPath = join(stateDir, 'replay-snapshot.json');
    await serializeReplayResult(result1, snapshotPath);

    // Replay again from same LogStore events (simulating separate process)
    const gateEvents2 = await readGates();
    const derivationRecords2 = await readDerivations();
    const result2 = await replayFromLogStore(gateEvents2, derivationRecords2);

    expect(result2.gateSnapshot).toEqual(result1.gateSnapshot);
    expect(result2.memory.getStatistics().totalConcepts).toBe(
      result1.memory.getStatistics().totalConcepts
    );
    expect(result2.memory.getStatistics().totalTasks).toBe(
      result1.memory.getStatistics().totalTasks
    );

    const c1 = result1.memory.getConcept(termParser.parse('(a-->c)'));
    const c2 = result2.memory.getConcept(termParser.parse('(a-->c)'));
    expect(c1?.getBeliefs()[0]?.truth).toEqual(c2?.getBeliefs()[0]?.truth);
    expect(c1?.priority).toBeCloseTo(c2?.priority ?? -1, 2);
  });

  it("replays with the original run's attention model when its parameters are given", async () => {
    const replay = async (cognitiveParams?: CognitiveParameters) => {
      // Create isolated LogStore for each replay (like original file-based test)
      const dir = mkdtempSync(join(tmpdir(), 'replay-attention-'));
      const logStore = createLogStore({ dir: join(dir, 'log') });
      await logStore.open();
      const gateLedger = createLogStoreGateEventLedger(logStore);

      const registry = new GateRegistry();
      await registry.getPerceptionGate().admit({
        sourceId: 's',
        rawObservation: '(a-->b).',
        sensorConfidence: 1,
        sourceQuality: 'PRIMARY',
      });
      await gateLedger.flush(registry);

      const gateEvents = await gateLedger.read();
      await logStore.close();

      const result = await replayFromLogStore(gateEvents, [], { cognitiveParams });
      const concept = result.memory.getConcept(termParser.parse('(a-->b)'))!;
      concept.writeAttention({ reason: 'assign', value: 1 });
      for (let i = 0; i < 10; i++) result.memory.consolidate();
      return concept.priority;
    };

    const configured = await replay({
      ...DEFAULT_COGNITIVE_PARAMETERS,
      strategies: {
        ...DEFAULT_COGNITIVE_PARAMETERS.strategies,
        attention: { type: 'simple', config: { boost: 0.3 } },
      },
    });
    const unconfigured = await replay(undefined);

    expect(configured).toBeLessThan(1);
    expect(unconfigured).toBe(1);
  });

  it('handles missing derivation records gracefully', async () => {
    const registry = new GateRegistry();
    registry.getPerceptionGate().admit({
      sourceId: 's',
      rawObservation: '(a-->b).',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    await flushGates(registry);

    const gateEvents = await readGates();
    const result = await replayFromLogStore(gateEvents, []);

    expect(result.appliedTasks).toBe(1);
    expect(result.appliedDerivations).toBe(0);
    expect(result.memory.getConcept(termParser.parse('(a-->b)'))).toBeDefined();
  });
});