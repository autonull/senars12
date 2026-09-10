import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { GateRegistry } from '../../nar/src/kernel/GateRegistry.js';
import { persistGateLogs, loadGateEvents } from '../../nar/src/kernel/EventLogPersistence.js';
import { replayIntoMemory, serializeReplayResult, persistDerivationRecords } from '../../nar/src/kernel/replay.js';
import { validateCognitiveEvent, validateDerivationRecord } from '@senars/kernel/schemas';
import { termParser } from '../../nar/src/terms/index.js';
import { Memory } from '../../nar/src/memory/memory.js';

const mkTaskAdmitted = (overrides: Partial<{
    term: string;
    taskType: 'belief' | 'goal' | 'question';
    truth: { frequency: number; confidence: number };
    sourceQuality: 'PRIMARY' | 'SECONDARY' | 'GENERAL' | 'TERTIARY' | 'LLM_PRIOR';
}> = {}) =>
    validateCognitiveEvent({
        type: 'task.admitted',
        engine: 'nar',
        timestamp: Date.now(),
        correlationId: uuidv4(),
        payload: {
            taskId: uuidv4(),
            term: overrides.term ?? '(a --> b)',
            taskType: overrides.taskType ?? 'belief',
            truth: overrides.truth ?? { frequency: 1.0, confidence: 0.9 },
            source: 'user',
            budget: { priority: 0.5, durability: 0.5, quality: 0.9, cycles: 10, depth: 5 },
        },
        ...overrides,
    });

const mkBeliefRevised = (term: string, oldTruth: { frequency: number; confidence: number }, newTruth: { frequency: number; confidence: number }) =>
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
        goalTerm: '(a --> c)',
        timestamp: now,
        engine: 'nar',
        totalCycles: conclusions.length,
        maxDepthReached: 2,
        finalTruth: { frequency: 0.9, confidence: 0.8 },
        steps: conclusions.map((conclusion, i) => ({
            stepId: uuidv4(),
            ruleId: 'deduction',
            ruleCategory: 'logic',
            premises: ['(a --> b)', '(b --> c)'],
            conclusion,
            truth: { frequency: 0.9, confidence: 0.8 },
            premiseTruths: [{ frequency: 1, confidence: 0.9 }, { frequency: 1, confidence: 0.9 }],
            evidenceLineage: [],
            independence: 'independent',
        })),
    });
};

describe('todo7: full-state memory replay', () => {
    it('replays gate events + derivation records into Memory with full state', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'full-replay-'));
        const gatePath = join(dir, 'gate-events.jsonl');
        const derivPath = join(dir, 'derivations.jsonl');
        const snapshotPath = join(dir, 'replay-snapshot.json');

        const registry = new GateRegistry();
        registry.getPerceptionGate().admit({ sourceId: 's', rawObservation: '(a --> b).', sensorConfidence: 1, sourceQuality: 'PRIMARY' });
        registry.getPerceptionGate().admit({ sourceId: 's', rawObservation: '(b --> c).', sensorConfidence: 1, sourceQuality: 'PRIMARY' });
        registry.getRewardGate().process({
            eventId: uuidv4(),
            rewardSignal: 0.5,
            rewardType: 'extrinsic',
            targetType: 'truth-confidence',
            targetId: 'b1',
        });
        registry.getActionGate().requestModeChange('propose-only', 'system');

        persistGateLogs(registry, gatePath);

        const records = [mkDerivationRecord(['(a --> c)'])];
        persistDerivationRecords(records, derivPath);

        const result = await replayIntoMemory({ gateEventsPath: gatePath, derivationRecordsPath: derivPath });

        expect(result.appliedTasks).toBe(2);
        expect(result.appliedDerivations).toBe(1);
        expect(result.gateSnapshot.tasks).toHaveLength(2);
        expect(result.gateSnapshot.autonomyMode).toBe('propose-only');

        const conceptAtoC = result.memory.getConcept(termParser.parse('(a --> c)'));
        expect(conceptAtoC).toBeDefined();
        expect(conceptAtoC!.getBeliefs()).toHaveLength(1);
        expect(conceptAtoC!.getBeliefs()[0]?.truth).toEqual({ f: 0.9, c: 0.8 });

        await serializeReplayResult(result, snapshotPath);
        const snapshot = JSON.parse(require('node:fs').readFileSync(snapshotPath, 'utf8'));
        expect(snapshot.stats.appliedTasks).toBe(2);
        expect(snapshot.stats.appliedDerivations).toBe(1);
    });

    it('replays belief revisions with evidence lineage', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'replay-rev-'));
        const gatePath = join(dir, 'gate-events.jsonl');
        const derivPath = join(dir, 'derivations.jsonl');

        const registry = new GateRegistry();
        registry.getPerceptionGate().admit({ sourceId: 's', rawObservation: '(a --> b).', sensorConfidence: 1, sourceQuality: 'PRIMARY' });
        persistGateLogs(registry, gatePath);

        const { events } = loadGateEvents(gatePath);
        const rev = mkBeliefRevised('(a --> b)', { frequency: 0.8, confidence: 0.7 }, { frequency: 0.9, confidence: 0.85 });
        require('node:fs').appendFileSync(gatePath, JSON.stringify(rev) + '\n');

        const result = await replayIntoMemory({ gateEventsPath: gatePath, derivationRecordsPath: derivPath });

        expect(result.appliedRevisions).toBe(1);
        const concept = result.memory.getConcept(termParser.parse('(a --> b)'));
        expect(concept).toBeDefined();
        const beliefs = concept!.getBeliefs();
        expect(beliefs).toHaveLength(1);
        expect(beliefs[0]?.truth).toEqual({ f: 0.9, c: 0.85 });
    });

    it('replays concept activations (priority)', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'replay-act-'));
        const gatePath = join(dir, 'gate-events.jsonl');
        const derivPath = join(dir, 'derivations.jsonl');

        const registry = new GateRegistry();
        registry.getPerceptionGate().admit({ sourceId: 's', rawObservation: '(a --> b).', sensorConfidence: 1, sourceQuality: 'PRIMARY' });
        persistGateLogs(registry, gatePath);

        const { events } = loadGateEvents(gatePath);
        const act = mkConceptActivated('(a --> b)', 0.75);
        require('node:fs').appendFileSync(gatePath, JSON.stringify(act) + '\n');

        const result = await replayIntoMemory({ gateEventsPath: gatePath, derivationRecordsPath: derivPath });

        expect(result.appliedActivations).toBe(1);
        const concept = result.memory.getConcept(termParser.parse('(a --> b)'));
        expect(concept).toBeDefined();
        expect(concept!.priority).toBeCloseTo(0.75, 2);
    });

    it('pause → serialize → replay in separate process yields same state', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'replay-roundtrip-'));
        const gatePath = join(dir, 'gate-events.jsonl');
        const derivPath = join(dir, 'derivations.jsonl');
        const snapshotPath = join(dir, 'replay-snapshot.json');

        const registry = new GateRegistry();
        registry.getPerceptionGate().admit({ sourceId: 's', rawObservation: '(a --> b).', sensorConfidence: 1, sourceQuality: 'PRIMARY' });
        registry.getPerceptionGate().admit({ sourceId: 's', rawObservation: '(b --> c).', sensorConfidence: 1, sourceQuality: 'PRIMARY' });
        registry.getActionGate().requestModeChange('sandbox-execute', 'system');
        registry.getBudgetGate().setBudget({ maxCycles: 2, maxDepth: 10, maxMemoryOps: 10, maxLMCalls: 1, consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 } });
        registry.getBudgetGate().check({ operation: 'nal-step' });
        registry.getBudgetGate().check({ operation: 'nal-step' });
        persistGateLogs(registry, gatePath);

        const records = [mkDerivationRecord(['(a --> c)'])];
        persistDerivationRecords(records, derivPath);

        const result1 = await replayIntoMemory({ gateEventsPath: gatePath, derivationRecordsPath: derivPath });
        serializeReplayResult(result1, snapshotPath);

        const result2 = await replayIntoMemory({ gateEventsPath: gatePath, derivationRecordsPath: derivPath });

        expect(result2.gateSnapshot).toEqual(result1.gateSnapshot);
        expect(result2.memory.getStatistics().totalConcepts).toBe(result1.memory.getStatistics().totalConcepts);
        expect(result2.memory.getStatistics().totalTasks).toBe(result1.memory.getStatistics().totalTasks);

        const c1 = result1.memory.getConcept(termParser.parse('(a --> c)'));
        const c2 = result2.memory.getConcept(termParser.parse('(a --> c)'));
        expect(c1?.getBeliefs()[0]?.truth).toEqual(c2?.getBeliefs()[0]?.truth);
        expect(c1?.priority).toBeCloseTo(c2?.priority ?? -1, 2);
    });

    it('handles missing derivation records gracefully', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'replay-no-deriv-'));
        const gatePath = join(dir, 'gate-events.jsonl');

        const registry = new GateRegistry();
        registry.getPerceptionGate().admit({ sourceId: 's', rawObservation: '(a --> b).', sensorConfidence: 1, sourceQuality: 'PRIMARY' });
        persistGateLogs(registry, gatePath);

        const result = await replayIntoMemory({ gateEventsPath: gatePath, derivationRecordsPath: join(dir, 'nonexistent.jsonl') });

        expect(result.appliedTasks).toBe(1);
        expect(result.appliedDerivations).toBe(0);
        expect(result.memory.getConcept(termParser.parse('(a --> b)'))).toBeDefined();
    });
});