/**
 * File-based replay compatibility — provides the legacy replay functions
 * that read from JSONL files (gate-events.jsonl, derivations.jsonl).
 *
 * These functions are kept for backward compatibility with the replay CLI
 * and tests. New code should use LogStore-based replay from @senars/log/replay.
 */
import { CognitiveEventSchema, } from '@senars/schemas/cognitive-events';
import { DerivationRecordSchema, } from '@senars/schemas/derivation-records';
import { createDefaultClock } from './env';
import { appendJsonl, readJsonlWith, writeJsonFileSync } from '@senars/util/fs';
import { errMsg } from '@senars/util/error';
import { installIdSource } from '@senars/util/id';
import { keyedBy } from '@senars/util/collections';
import { sha256Hex } from '@senars/util/hash';
import { stableStringify } from '@senars/util/json';
import { createDefaultRegistry, resolveSlot } from '../cognitive/impls/CognitiveRegistry';
import { Memory } from '../memory/memory';
import { serialize as serializeMemory } from '../memory/state/serialization';
import { isProposalStream, replayProposalStream } from '../proposal/replay';
import { rehydrateTask } from '../task/record';
import { Stamp, Truth, termParser, termsEqual } from '../terms/index';
import { NEUTRAL_BUDGET } from '../types/index';
import { replayCognitiveState, } from '../log/replay-reducers';
import { createLogger } from '../util/logger';
const logger = createLogger({ scope: 'kernel:replay-compat' });
function makeDerivedStamp(id) {
    return {
        id,
        creationTime: 0,
        source: 'DERIVED',
        derivations: [],
    };
}
function taskTypeFromEvent(type) {
    return type;
}
export async function replayIntoMemory(options) {
    const restoreIds = options.ids ? installIdSource(options.ids) : undefined;
    try {
        return await replayWithInjectedEntropy(options);
    }
    finally {
        restoreIds?.();
    }
}
async function replayWithInjectedEntropy(options) {
    const { gateEventsPath, derivationRecordsPath, memoryConfig, range, idRange, rng, clock } = options;
    const now = () => (clock ?? createDefaultClock()).now();
    const { events: allGateEvents, invalid: gateInvalid } = loadGateEvents(gateEventsPath);
    if (gateInvalid > 0) {
        logger.warn(`[replay] ${gateInvalid} invalid gate events skipped`);
    }
    let gateEvents = allGateEvents;
    if (idRange?.from || idRange?.to) {
        const fromIdx = idRange.from ? allGateEvents.findIndex((e) => e.id === idRange.from) : 0;
        const toIdx = idRange.to
            ? allGateEvents.findIndex((e) => e.id === idRange.to) + 1
            : allGateEvents.length;
        if (fromIdx >= 0 && toIdx >= 0) {
            gateEvents = allGateEvents.slice(Math.max(0, fromIdx), toIdx);
        }
        else {
            logger.warn('[replay] ID range not found, falling back to ordinal range');
            const from = Math.max(0, range?.from ?? 0);
            gateEvents =
                range?.to === undefined
                    ? allGateEvents.slice(from)
                    : allGateEvents.slice(from, range.to + 1);
        }
    }
    else {
        const from = Math.max(0, range?.from ?? 0);
        gateEvents =
            range?.to === undefined ? allGateEvents.slice(from) : allGateEvents.slice(from, range.to + 1);
    }
    const derivationRecords = derivationRecordsPath
        ? readJsonlWith(derivationRecordsPath, DerivationRecordSchema).rows
        : [];
    const { cognitiveParams, strategyRegistry } = options;
    // Convert kernel Clock (with now/setTime/advance) to util Clock (() => number)
    const utilClock = clock ? () => clock.now() : undefined;
    const memory = new Memory(rng || clock ? { ...memoryConfig, bag: { ...memoryConfig?.bag, rng, clock: utilClock } } : memoryConfig, {
        attentionModel: cognitiveParams
            ? resolveSlot(strategyRegistry ?? createDefaultRegistry(), cognitiveParams, 'attention')
            : undefined,
    });
    const errors = [];
    const replayed = (label, source, apply) => {
        try {
            return apply();
        }
        catch (e) {
            errors.push(`${label} failed: ${source} - ${errMsg(e)}`);
            return false;
        }
    };
    const conceptOf = (narsese) => {
        const term = termParser.parse(narsese);
        return [term, memory.addConcept(term)];
    };
    let appliedTasks = 0;
    let appliedRevisions = 0;
    let appliedDerivations = 0;
    let appliedActivations = 0;
    let appliedProposals = 0;
    let skipped = 0;
    const proposalState = isProposalStream(gateEvents)
        ? replayProposalStream(gateEvents)
        : undefined;
    for (const event of gateEvents) {
        if (event.type === 'task.admitted') {
            const record = {
                term: event.payload.term,
                type: taskTypeFromEvent(event.payload.taskType),
                truth: event.payload.truth ? { f: event.payload.truth.frequency, c: event.payload.truth.confidence } : undefined,
                budget: event.payload.budget?.priority,
                stamp: undefined,
                occurrenceTime: undefined,
            };
            const restored = rehydrateTask(record);
            if (restored) {
                if (memory.addTask(restored.term, restored.type, restored.truth, restored.budget, restored.stamp)) {
                    appliedTasks++;
                }
                else {
                    skipped++;
                }
            }
            else {
                skipped++;
            }
        }
    }
    for (const event of gateEvents) {
        if (event.type === 'belief.revised') {
            if (replayed('Revision', event.payload.term, () => {
                const [term, concept] = conceptOf(event.payload.term);
                const matching = concept.getBeliefs().find((b) => termsEqual(b.term, term));
                if (!matching)
                    return false;
                concept.removeBelief(matching.id);
                concept.addTask('belief', {
                    ...matching,
                    truth: Truth.fromUnknown(event.payload.newTruth),
                    timestamp: now(),
                });
                return true;
            })) {
                appliedRevisions++;
            }
            else {
                skipped++;
            }
        }
        else if (event.type === 'concept.activated') {
            if (replayed('Activation', event.payload.term, () => {
                conceptOf(event.payload.term)[1].writeAttention({
                    reason: 'assign',
                    value: event.payload.priority,
                });
                return true;
            })) {
                appliedActivations++;
            }
            else {
                skipped++;
            }
        }
    }
    for (const record of derivationRecords) {
        for (const step of record.steps) {
            if (replayed('Derivation step', step.conclusion, () => {
                const [term, concept] = conceptOf(step.conclusion);
                const existing = concept.getBeliefs().find((b) => termsEqual(b.term, term));
                const truth = Truth.fromUnknown(step.truth);
                if (!existing) {
                    const parent = Stamp.createInput();
                    const parents = step.evidenceLineage.length > 0
                        ? step.evidenceLineage.map(makeDerivedStamp)
                        : [parent];
                    concept.addTask('belief', {
                        term,
                        truth,
                        budget: NEUTRAL_BUDGET,
                        stamp: Stamp.derive(parents, 'DERIVED') ?? parent,
                        derived: true,
                    });
                    return true;
                }
                if (step.independence === 'unknown')
                    return false;
                concept.removeBelief(existing.id);
                concept.addTask('belief', { ...existing, truth, timestamp: now() });
                return true;
            })) {
                appliedDerivations++;
            }
            else {
                skipped++;
            }
        }
    }
    const gateSnapshot = replayCognitiveState(gateEvents);
    return {
        memory,
        gateSnapshot,
        proposalState,
        appliedTasks,
        appliedRevisions,
        appliedDerivations,
        appliedActivations,
        appliedProposals,
        skipped,
        errors,
    };
}
const HASHED_FIELDS = [
    'appliedTasks',
    'appliedRevisions',
    'appliedDerivations',
    'appliedActivations',
    'appliedProposals',
    'skipped',
    'errors',
    'gateSnapshot',
    'proposalState',
];
export function computeReplayStateHash(result, serializedMemory) {
    const canonicalMemory = { ...(serializedMemory ?? serializeMemory(result.memory)), timestamp: 0 };
    return sha256Hex(stableStringify({
        counters: keyedBy(HASHED_FIELDS, (field) => field, (field) => result[field]),
        memory: canonicalMemory,
    }));
}
export function verifyReplayStateHash(result, expectedHash) {
    const actual = computeReplayStateHash(result);
    return { valid: actual === expectedHash, actual };
}
export async function serializeReplayResult(result, outputPath, clock) {
    const { gateSnapshot, proposalState, memory, appliedTasks, appliedRevisions, appliedDerivations, appliedActivations, appliedProposals, skipped, errors, } = result;
    const memorySerialized = serializeMemory(memory);
    const canonicalMemory = { ...memorySerialized, timestamp: 0 };
    const snapshot = {
        version: 2,
        timestamp: (clock ?? createDefaultClock()).now(),
        stateHash: computeReplayStateHash(result, memorySerialized),
        gateSnapshot,
        proposalState,
        memory: canonicalMemory,
        stats: {
            appliedTasks,
            appliedRevisions,
            appliedDerivations,
            appliedActivations,
            appliedProposals,
            skipped,
            errors,
        },
    };
    writeJsonFileSync(outputPath, snapshot);
}
export function persistDerivationRecords(records, path) {
    return { appended: appendJsonl(path, records) };
}
export function loadGateEvents(path) {
    const { rows, invalid } = readJsonlWith(path, CognitiveEventSchema);
    return { events: rows, invalid };
}
export { replayTaskAdmissions, replayCognitiveState } from '../log/replay-reducers';
