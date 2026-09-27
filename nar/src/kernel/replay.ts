import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import type {
  AutonomyMode,
  CognitiveEvent,
  DerivationRecord,
  TaskAdmittedEvent,
} from '@senars/kernel/schemas';
import {
  CognitiveEventSchema,
  DerivationRecordSchema,
  validateCognitiveEvent,
  validateDerivationRecord,
} from '@senars/kernel/schemas';
import type { Concept, ConceptTaskType, TaskData } from '../memory/concept.js';
import { Memory } from '../memory/memory.js';
import { Stamp, Truth, termParser } from '../terms/index.js';
import type { Budget, Timestamp } from '../types/index.js';
import { createBudget } from '../types/index.js';
import {
  loadGateEvents,
  persistGateLogs,
  replayCognitiveState,
  replayTaskAdmissions,
} from './EventLogPersistence.js';
import type { GateRegistry } from './GateRegistry.js';
import { serialize as serializeMemory } from '../memory/state/serialization.js';

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
  /** Inclusive ordinal window over the gate-event log (no `id` field exists on CognitiveEvent). */
  range?: { from?: number; to?: number };
  /** Inclusive event ID window over the gate-event log (preferred over ordinals). */
  idRange?: { from?: string; to?: string };
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
  const parents = derivations.length > 0 ? derivations.map(makeDerivedStamp) : [parent];
  return Stamp.derive(parents, 'DERIVED') ?? Stamp.createInput();
}

export async function replayIntoMemory(options: FullReplayOptions): Promise<ReplayResult> {
  const { gateEventsPath, derivationRecordsPath, memoryConfig, range, idRange } = options;

  const { events: allGateEvents, invalid: gateInvalid } = loadGateEvents(gateEventsPath);
  if (gateInvalid > 0) {
    console.warn(`[replay] ${gateInvalid} invalid gate events skipped`);
  }

  // Filter by event ID if provided (preferred), otherwise by ordinal
  let gateEvents = allGateEvents;
  if (idRange?.from || idRange?.to) {
    const fromIdx = idRange.from ? allGateEvents.findIndex((e) => e.id === idRange.from) : 0;
    const toIdx = idRange.to
      ? allGateEvents.findIndex((e) => e.id === idRange.to) + 1
      : allGateEvents.length;
    if (fromIdx >= 0 && toIdx >= 0) {
      gateEvents = allGateEvents.slice(Math.max(0, fromIdx), toIdx);
    } else {
      console.warn('[replay] ID range not found, falling back to ordinal range');
      const from = Math.max(0, range?.from ?? 0);
      gateEvents = range?.to === undefined ? allGateEvents.slice(from) : allGateEvents.slice(from, range.to + 1);
    }
  } else {
    const from = Math.max(0, range?.from ?? 0);
    gateEvents = range?.to === undefined ? allGateEvents.slice(from) : allGateEvents.slice(from, range.to + 1);
  }

  const derivationRecords: DerivationRecord[] = [];
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
      const truth = task.truth
        ? Truth.create(task.truth.frequency, task.truth.confidence)
        : undefined;
      const budget = createBudget(task.budget?.priority ?? 0.5);
      const stamp = Stamp.createInput();
      const ok = memory.addTask(term, taskTypeFromEvent(task.taskType), truth, budget, stamp);
      if (ok) appliedTasks++;
      else skipped++;
    } catch (e) {
      skipped++;
      errors.push(
        `Task admission failed: ${task.term} - ${e instanceof Error ? e.message : String(e)}`
      );
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
          const updatedTruth = Truth.create(
            event.payload.newTruth.frequency,
            event.payload.newTruth.confidence
          );
          concept.beliefBag.remove(matching);
          concept.addTask('belief', { ...matching, truth: updatedTruth, timestamp: Date.now() });
          appliedRevisions++;
        } else {
          skipped++;
        }
      } catch (e) {
        skipped++;
        errors.push(
          `Revision failed: ${event.payload.term} - ${e instanceof Error ? e.message : String(e)}`
        );
      }
    } else if (event.type === 'concept.activated') {
      try {
        const term = termParser.parse(event.payload.term);
        const concept = memory.getConcept(term) ?? memory.addConcept(term);
        concept.priority = event.payload.priority;
        appliedActivations++;
      } catch (e) {
        skipped++;
        errors.push(
          `Activation failed: ${event.payload.term} - ${e instanceof Error ? e.message : String(e)}`
        );
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
          const parents =
            step.evidenceLineage.length > 0 ? step.evidenceLineage.map(makeDerivedStamp) : [parent];
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
        errors.push(
          `Derivation step failed: ${step.conclusion} - ${e instanceof Error ? e.message : String(e)}`
        );
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

const HASHED_FIELDS = [
  'appliedTasks',
  'appliedRevisions',
  'appliedDerivations',
  'appliedActivations',
  'skipped',
  'errors',
  'gateSnapshot',
] as const satisfies readonly (keyof ReplayResult)[];

/** Deterministic content hash of a replay outcome — the C14 replay verification token. */
export async function computeReplayStateHash(result: ReplayResult): Promise<string> {
  const hash = createHash('sha256');
  const memorySerialized = serializeMemory(result.memory);
  // Canonicalize: remove timestamp for deterministic hashing
  const canonicalMemory = { ...memorySerialized, timestamp: 0 };
  hash.update(
    JSON.stringify({
      counters: Object.fromEntries(HASHED_FIELDS.map((field) => [field, result[field]])),
      memory: canonicalMemory,
    })
  );
  return hash.digest('hex');
}

export async function verifyReplayStateHash(
  result: ReplayResult,
  expectedHash: string
): Promise<{ valid: boolean; actual: string }> {
  const actual = await computeReplayStateHash(result);
  return { valid: actual === expectedHash, actual };
}

export interface ReplaySnapshotStats {
  appliedTasks: number;
  appliedRevisions: number;
  appliedDerivations: number;
  appliedActivations: number;
  skipped: number;
  errors: string[];
}

export interface ReplaySnapshotFile {
  version: number;
  timestamp: number;
  stateHash: string;
  gateSnapshot: ReplayResult['gateSnapshot'];
  memory: unknown;
  stats: ReplaySnapshotStats;
}

export async function serializeReplayResult(
  result: ReplayResult,
  outputPath: string
): Promise<void> {
  const { gateSnapshot, memory, appliedTasks, appliedRevisions, appliedDerivations, appliedActivations, skipped, errors } = result;
  const memorySerialized = serializeMemory(memory);
  // Canonicalize: remove timestamp for deterministic hashing
  const canonicalMemory = { ...memorySerialized, timestamp: 0 };
  const snapshot: ReplaySnapshotFile = {
    version: 1,
    timestamp: Date.now(),
    stateHash: await computeReplayStateHash(result),
    gateSnapshot,
    memory: canonicalMemory,
    stats: {
      appliedTasks,
      appliedRevisions,
      appliedDerivations,
      appliedActivations,
      skipped,
      errors,
    },
  };
  writeFileSync(outputPath, JSON.stringify(snapshot, null, 2));
}

export function persistDerivationRecords(
  records: DerivationRecord[],
  path: string
): { appended: number } {
  if (records.length === 0) return { appended: 0 };
  appendFileSync(path, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return { appended: records.length };
}

export function loadDerivationRecords(path: string): {
  records: DerivationRecord[];
  invalid: number;
} {
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
