/**
 * Memory serialization.
 *
 * Full round-trip: Narsese terms, truth, budget priority, concept priorities,
 * and stamps. Restored stamp IDs re-seed the atomic counter (see
 * observeStampId), so newly minted stamps never collide with reloaded ones.
 *
 * No version migration is kept: there are no persisted dumps in the wild yet,
 * so the format is versioned (version 1) but has a single reader/writer.
 */
import { createLogger } from '../../util/logger';
import { decodeState, encodeState, NAR_STATE_SCHEMA_VERSION } from '../../state/codec';
import { rehydrateTask } from '../../task/record';
import { serializeStamp, termParser } from '../../terms';
import { SenarsError } from '../../errors/senars-error';
const logger = createLogger({ scope: 'Memory.State' });
export const MEMORY_VERSION = NAR_STATE_SCHEMA_VERSION;
const MEMORY_STATE_KIND = 'memory.state';
/** Schema-pinned, versioned persistence format for the memory dump (StateCodec, TODO20 X7). */
export const encodeMemoryState = (memory) => encodeState(MEMORY_STATE_KIND, MEMORY_VERSION, serialize(memory));
/** Inverse of encodeMemoryState; accepts legacy bare SerializedMemory files. */
export const decodeMemoryState = (text) => decodeState(text, MEMORY_STATE_KIND, MEMORY_VERSION);
export function serialize(memory) {
    const concepts = [];
    // The statistics are the counts of the walk below, so they are accumulated by it
    // rather than read back through `totals()`, which sweeps every concept a second
    // time to derive what the first pass already passed over.
    let totalTasks = 0;
    for (const concept of memory.conceptValues()) {
        const beliefs = serializeBag(concept.beliefBag);
        const goals = serializeBag(concept.goalBag);
        const questions = serializeBag(concept.questionBag);
        totalTasks += beliefs.length + goals.length + questions.length;
        concepts.push({
            term: concept.term.toString(),
            priority: concept.priority,
            beliefs,
            goals,
            questions,
        });
    }
    return {
        version: MEMORY_VERSION,
        timestamp: Date.now(),
        concepts,
        statistics: { totalConcepts: concepts.length, totalTasks },
    };
}
function serializeBag(bag) {
    const tasks = [];
    for (const item of bag.all()) {
        tasks.push({
            term: item.term.toString(),
            truth: item.truth ? { f: item.truth.f, c: item.truth.c } : undefined,
            budget: item.budget.priority ?? item.priority,
            stamp: item.stamp ? serializeStamp(item.stamp) : undefined,
            occurrenceTime: item.occurrenceTime,
        });
    }
    return tasks;
}
export async function deserialize(data, memory) {
    if (data.version !== MEMORY_VERSION) {
        throw new SenarsError(`Unsupported memory version: ${data.version}`, 'OPERATION_ERROR');
    }
    memory.clear();
    for (const serialized of data.concepts) {
        try {
            const term = termParser.parse(serialized.term);
            const concept = memory.addConcept(term);
            restoreBag(concept, 'belief', serialized.beliefs);
            restoreBag(concept, 'goal', serialized.goals);
            restoreBag(concept, 'question', serialized.questions);
            // Last: task restore bumps priority via recordAccess; the dump wins.
            if (typeof serialized.priority === 'number') {
                concept.writeAttention({ reason: 'assign', value: serialized.priority });
            }
        }
        catch {
            // expected: individual concept deserialization failure shouldn't abort memory load
            logger.warn('Failed to deserialize concept', { term: serialized.term });
        }
    }
}
function restoreBag(concept, type, tasks) {
    for (const record of tasks ?? []) {
        const task = rehydrateTask(record, type);
        if (task) {
            concept.addTask(type, {
                term: task.term,
                truth: task.truth,
                budget: task.budget,
                stamp: task.stamp,
            });
            continue;
        }
        // expected: individual task deserialization failure shouldn't abort concept load
        logger.warn('Failed to deserialize task', { term: record.term, type });
    }
}
export function validate(data) {
    if (!data.version || !data.concepts || !data.statistics)
        return false;
    if (data.version !== MEMORY_VERSION)
        return false;
    if (!Array.isArray(data.concepts))
        return false;
    for (const concept of data.concepts) {
        if (!concept.term || typeof concept.priority !== 'number')
            return false;
        for (const bag of [concept.beliefs, concept.goals, concept.questions]) {
            if (!bag)
                continue;
            if (!Array.isArray(bag))
                return false;
            for (const task of bag) {
                if (!task.term)
                    return false;
                if (task.stamp &&
                    (typeof task.stamp.id !== 'string' || !Array.isArray(task.stamp.derivations))) {
                    return false;
                }
            }
        }
    }
    return true;
}
export function repair(data) {
    try {
        if (!data.version)
            data.version = MEMORY_VERSION;
        if (!data.concepts)
            data.concepts = [];
        if (!data.statistics) {
            data.statistics = {
                totalConcepts: data.concepts?.length || 0,
                totalTasks: 0,
            };
        }
        if (!data.timestamp)
            data.timestamp = Date.now();
        if (validate(data)) {
            return data;
        }
    }
    catch {
        // expected: repair is best-effort; returns null on failure
        logger.warn('Failed to repair memory data');
    }
    return null;
}
