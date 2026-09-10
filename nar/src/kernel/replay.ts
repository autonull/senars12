import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { AutonomyMode, CognitiveEvent, DerivationRecord, TaskAdmittedEvent } from '@senars/kernel/schemas';
import { CognitiveEventSchema, DerivationRecordSchema } from '@senars/kernel/schemas';
import type { GateRegistry } from './GateRegistry.js';
import { loadGateEvents, persistGateLogs, replayCognitiveState, replayTaskAdmissions } from './EventLogPersistence.js';
import { validateCognitiveEvent, validateDerivationRecord } from '@senars/kernel/schemas';
import { Memory } from '../memory/memory.js';
import { termParser, Truth, Stamp } from '../terms/index.js';
import type { Timestamp } from '../types/index.js';
import type { Concept, TaskData, ConceptTaskType } from '../memory/concept.js';
import type { Budget } from '../types/index.js';
import { createBudget } from '../types/index.js';

function makeDerivedStamp(id: string): Stamp {
    return {
        id,
        creationTime: 0 as Timestamp,
        source: 'DERIVED' as const,
        derivations: [],
    };
}

export interface FullReplayOptions {
    gateEventsPath: string;
    derivationRecordsPath?: string;
    memoryConfig?: ConstructorParameters<typeof Memory>[0];
}

export interface ReplayResult {
    memory: Memory;
    gateSnapshot: ReturnType<typeof replayCognitiveState>;
    appliedTasks: number;
    appliedRevisions: number;
    appliedDerivations: number;
    appliedActivations: number;
    skipped: number;
    errors: string[];
}

function taskTypeFromEvent(type: TaskAdmittedEvent['payload']['taskType']): ConceptTaskType {
    return type as ConceptTaskType;
}

function stampFromEvent(event: TaskAdmittedEvent): Stamp {
    const derivations = event.payload.budget?.depth ? [event.correlationId] : [];
    const parent = Stamp.createInput();
    const parents = derivations.length > 0
        ? derivations.map(makeDerivedStamp)
        : [parent];
    return Stamp.derive(parents, 'DERIVED') ?? Stamp.createInput();
}

export async function replayIntoMemory(options: FullReplayOptions): Promise<ReplayResult> {
    const { gateEventsPath, derivationRecordsPath, memoryConfig } = options;

    const { events: gateEvents, invalid: gateInvalid } = loadGateEvents(gateEventsPath);
    if (gateInvalid > 0) {
        console.warn(`[replay] ${gateInvalid} invalid gate events skipped`);
    }

    let derivationRecords: DerivationRecord[] = [];
    if (derivationRecordsPath && existsSync(derivationRecordsPath)) {
        for (const line of readFileSync(derivationRecordsPath, 'utf8').split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
                const parsed = DerivationRecordSchema.safeParse(JSON.parse(trimmed));
                if (parsed.success) derivationRecords.push(parsed.data);
            } catch {
                // skip invalid
            }
        }
    }

    const memory = new Memory(memoryConfig);
    const errors: string[] = [];
    let appliedTasks = 0;
    let appliedRevisions = 0;
    let appliedDerivations = 0;
    let appliedActivations = 0;
    let skipped = 0;

    const admittedTasks = replayTaskAdmissions(gateEvents);

    for (const task of admittedTasks) {
        try {
            const term = termParser.parse(task.term);
            const truth = task.truth ? Truth.create(task.truth.frequency, task.truth.confidence) : undefined;
            const budget = createBudget(task.budget?.priority ?? 0.5);
            const stamp = Stamp.createInput();
            const ok = memory.addTask(term, taskTypeFromEvent(task.taskType), truth, budget, stamp);
            if (ok) appliedTasks++; else skipped++;
        } catch (e) {
            skipped++;
            errors.push(`Task admission failed: ${task.term} - ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    for (const event of gateEvents) {
        if (event.type === 'belief.revised') {
            try {
                const term = termParser.parse(event.payload.term);
                const concept = memory.getConcept(term) ?? memory.addConcept(term);
                const beliefs = concept.getBeliefs();
                const matching = beliefs.find((b) => b.term.toString() === event.payload.term);
                if (matching) {
                    const updatedTruth = Truth.create(event.payload.newTruth.frequency, event.payload.newTruth.confidence);
                    concept.beliefBag.remove(matching);
                    concept.addTask('belief', { ...matching, truth: updatedTruth, timestamp: Date.now() });
                    appliedRevisions++;
                } else {
                    skipped++;
                }
            } catch (e) {
                skipped++;
                errors.push(`Revision failed: ${event.payload.term} - ${e instanceof Error ? e.message : String(e)}`);
            }
        } else if (event.type === 'concept.activated') {
            try {
                const term = termParser.parse(event.payload.term);
                const concept = memory.getConcept(term) ?? memory.addConcept(term);
                concept.priority = event.payload.priority;
                appliedActivations++;
            } catch (e) {
                skipped++;
                errors.push(`Activation failed: ${event.payload.term} - ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }

    for (const record of derivationRecords) {
        for (const step of record.steps) {
            try {
                const term = termParser.parse(step.conclusion);
                const concept = memory.getConcept(term) ?? memory.addConcept(term);
                const existing = concept.getBeliefs().find((b) => b.term.toString() === step.conclusion);
                if (!existing) {
                    const truth = Truth.create(step.truth.frequency, step.truth.confidence);
                    const budget = createBudget(0.5);
                    const parent = Stamp.createInput();
                    const parents = step.evidenceLineage.length > 0
                        ? step.evidenceLineage.map(makeDerivedStamp)
                        : [parent];
                    const stamp = Stamp.derive(parents, 'DERIVED') ?? Stamp.createInput();
                    concept.addTask('belief', { term, truth, budget, stamp, derived: true });
                    appliedDerivations++;
                } else if (step.independence !== 'unknown') {
                    const updatedTruth = Truth.create(step.truth.frequency, step.truth.confidence);
                    concept.beliefBag.remove(existing);
                    concept.addTask('belief', { ...existing, truth: updatedTruth, timestamp: Date.now() });
                    appliedDerivations++;
                }
            } catch (e) {
                skipped++;
                errors.push(`Derivation step failed: ${step.conclusion} - ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }

    const gateSnapshot = replayCognitiveState(gateEvents);

    return {
        memory,
        gateSnapshot,
        appliedTasks,
        appliedRevisions,
        appliedDerivations,
        appliedActivations,
        skipped,
        errors,
    };
}

export async function serializeReplayResult(result: ReplayResult, outputPath: string): Promise<void> {
    const snapshot = {
        version: 1,
        timestamp: Date.now(),
        gateSnapshot: result.gateSnapshot,
        memory: await serializeMemoryForReplay(result.memory),
        stats: {
            appliedTasks: result.appliedTasks,
            appliedRevisions: result.appliedRevisions,
            appliedDerivations: result.appliedDerivations,
            appliedActivations: result.appliedActivations,
            skipped: result.skipped,
            errors: result.errors,
        },
    };
    writeFileSync(outputPath, JSON.stringify(snapshot, null, 2));
}

async function serializeMemoryForReplay(memory: Memory) {
    const { serialize } = await import('../memory/state/serialization.js');
    return serialize(memory);
}

export function persistDerivationRecords(records: DerivationRecord[], path: string): { appended: number } {
    if (records.length === 0) return { appended: 0 };
    appendFileSync(path, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
    return { appended: records.length };
}

export function loadDerivationRecords(path: string): { records: DerivationRecord[]; invalid: number } {
    if (!existsSync(path)) return { records: [], invalid: 0 };
    const records: DerivationRecord[] = [];
    let invalid = 0;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
            const parsed = DerivationRecordSchema.safeParse(JSON.parse(trimmed));
            if (parsed.success) records.push(parsed.data);
            else invalid++;
        } catch {
            invalid++;
        }
    }
    return { records, invalid };
}