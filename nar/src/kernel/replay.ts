import type {
  AutonomyMode,
  CognitiveEvent,
  DerivationRecord,
  TaskAdmittedEvent,
} from '@senars/core/schemas';
import {
  CognitiveEventSchema,
  DerivationRecordSchema,
  validateCognitiveEvent,
  validateDerivationRecord,
} from '@senars/core/schemas';
import { appendJsonl, errMsg, keyedBy, readJsonl, sha256Hex, writeJsonFileSync } from '@senars/util';
import { createDefaultRegistry, resolveSlot } from '../cognitive/impls/CognitiveRegistry.js';
import type { CognitiveParameters } from '../config/cognitive-parameters.js';
import type { Concept, ConceptTaskType, TaskData } from '../memory/concept.js';
import { Memory } from '../memory/memory.js';
import type { MemoryPorts } from '../memory/ports/index.js';
import { serialize as serializeMemory } from '../memory/state/serialization.js';
import type { ProposalReplayState } from '../proposal/replay.js';
import { isProposalStream, replayProposalStream } from '../proposal/replay.js';
import type { AttentionModel } from '../strategies/types.js';
import { rehydrateTask } from '../task/record.js';
import { Stamp, Truth, termParser, termsEqual } from '../terms/index.js';
import type { Budget, Timestamp } from '../types/index.js';
import { createTaskWeight } from '../types/index.js';
import {
  loadGateEvents,
  persistGateLogs,
  replayCognitiveState,
  replayTaskAdmissions,
} from './EventLogPersistence.js';
import type { GateRegistry } from './GateRegistry.js';

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
  /**
   * The original run's strategy parameters. A replay exists to reproduce a
   * run, so it resolves its attention model from the same slot the NAR did
   * rather than inheriting `NullAttentionModel` (TODO27 §18) — a memory primed
   * nothing during a replay that the original run primed.
   */
  cognitiveParams?: CognitiveParameters;
  strategyRegistry?: ReturnType<typeof createDefaultRegistry>;
  /** Inclusive ordinal window over the gate-event log (no `id` field exists on CognitiveEvent). */
  range?: { from?: number; to?: number };
  /** Inclusive event ID window over the gate-event log (preferred over ordinals). */
  idRange?: { from?: string; to?: string };
}

export interface ReplayResult {
  /** The reconstructed store, as a port: replay reads it, it does not own it. */
  memory: MemoryPorts;
  gateSnapshot: ReturnType<typeof replayCognitiveState>;
  /**
   * A9: the proposal seam's own reduction, from the same log. `undefined` for a
   * log with no `proposal.*` events, so a caller can tell "no proposals were
   * recorded" from "there was nothing to reduce".
   */
  proposalState?: ProposalReplayState;
  appliedTasks: number;
  appliedRevisions: number;
  appliedDerivations: number;
  appliedActivations: number;
  appliedProposals: number;
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
      gateEvents =
        range?.to === undefined
          ? allGateEvents.slice(from)
          : allGateEvents.slice(from, range.to + 1);
    }
  } else {
    const from = Math.max(0, range?.from ?? 0);
    gateEvents =
      range?.to === undefined ? allGateEvents.slice(from) : allGateEvents.slice(from, range.to + 1);
  }

  const derivationRecords: DerivationRecord[] = derivationRecordsPath
    ? readJsonl(derivationRecordsPath, (value) => {
        const parsed = DerivationRecordSchema.safeParse(value);
        return parsed.success ? parsed.data : null;
      }).rows
    : [];

  const { cognitiveParams, strategyRegistry } = options;
  const memory = new Memory(memoryConfig, {
    attentionModel: cognitiveParams
      ? resolveSlot<AttentionModel>(
          strategyRegistry ?? createDefaultRegistry(),
          cognitiveParams,
          'attention'
        )
      : undefined,
  });
  const errors: string[] = [];
  let appliedTasks = 0;
  let appliedRevisions = 0;
  let appliedDerivations = 0;
  let appliedActivations = 0;
  let skipped = 0;

  // A9: reduce the proposal seam's events before touching memory, so a stream
  // recorded under an incompatible schema version fails here rather than
  // producing a half-reconstructed store that looks like a successful replay.
  const proposalState = isProposalStream(gateEvents) ? replayProposalStream(gateEvents) : undefined;
  const appliedProposals = proposalState?.admissions.length ?? 0;

  const admittedTasks = replayTaskAdmissions(gateEvents);

  for (const { term: raw, taskType, truth, budget } of admittedTasks) {
    const restored = rehydrateTask({
      term: raw,
      type: taskTypeFromEvent(taskType),
      truth: truth ? { f: truth.frequency, c: truth.confidence } : undefined,
      budget: budget?.priority,
    });
    if (!restored) {
      skipped++;
      errors.push(`Task admission failed: ${raw} - term did not parse`);
      continue;
    }
    if (
      memory.addTask(restored.term, restored.type, restored.truth, restored.budget, restored.stamp)
    ) {
      appliedTasks++;
    } else {
      skipped++;
    }
  }

  for (const event of gateEvents) {
    if (event.type === 'belief.revised') {
      try {
        const term = termParser.parse(event.payload.term);
        const concept = memory.getConcept(term) ?? memory.addConcept(term);
        const beliefs = concept.getBeliefs();
        const matching = beliefs.find((b) => termsEqual(b.term, term));
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
        errors.push(`Revision failed: ${event.payload.term} - ${errMsg(e)}`);
      }
    } else if (event.type === 'concept.activated') {
      try {
        const term = termParser.parse(event.payload.term);
        const concept = memory.getConcept(term) ?? memory.addConcept(term);
        concept.writeAttention({ reason: 'assign', value: event.payload.priority });
        appliedActivations++;
      } catch (e) {
        skipped++;
        errors.push(`Activation failed: ${event.payload.term} - ${errMsg(e)}`);
      }
    }
  }

  for (const record of derivationRecords) {
    for (const step of record.steps) {
      try {
        const term = termParser.parse(step.conclusion);
        const concept = memory.getConcept(term) ?? memory.addConcept(term);
        const existing = concept.getBeliefs().find((b) => termsEqual(b.term, term));
        if (!existing) {
          const truth = Truth.create(step.truth.frequency, step.truth.confidence);
          const budget = createTaskWeight(0.5);
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
        errors.push(`Derivation step failed: ${step.conclusion} - ${errMsg(e)}`);
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
] as const satisfies readonly (keyof ReplayResult)[];

/** Deterministic content hash of a replay outcome — the C14 replay verification token. */
export async function computeReplayStateHash(result: ReplayResult): Promise<string> {
  // Canonicalize: drop the timestamp so the hash is deterministic across runs.
  const canonicalMemory = { ...serializeMemory(result.memory), timestamp: 0 };
  return sha256Hex(
    JSON.stringify({
      counters: keyedBy(HASHED_FIELDS, (field) => field, (field) => result[field]),
      memory: canonicalMemory,
    })
  );
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
  appliedProposals: number;
  skipped: number;
  errors: string[];
}

export interface ReplaySnapshotFile {
  version: number;
  timestamp: number;
  stateHash: string;
  gateSnapshot: ReplayResult['gateSnapshot'];
  proposalState?: ProposalReplayState;
  memory: unknown;
  stats: ReplaySnapshotStats;
}

export async function serializeReplayResult(
  result: ReplayResult,
  outputPath: string
): Promise<void> {
  const {
    gateSnapshot,
    proposalState,
    memory,
    appliedTasks,
    appliedRevisions,
    appliedDerivations,
    appliedActivations,
    appliedProposals,
    skipped,
    errors,
  } = result;
  const memorySerialized = serializeMemory(memory);
  // Canonicalize: remove timestamp for deterministic hashing
  const canonicalMemory = { ...memorySerialized, timestamp: 0 };
  const snapshot: ReplaySnapshotFile = {
    version: 2,
    timestamp: Date.now(),
    stateHash: await computeReplayStateHash(result),
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

export function persistDerivationRecords(
  records: DerivationRecord[],
  path: string
): { appended: number } {
  return { appended: appendJsonl(path, records) };
}

export function loadDerivationRecords(path: string): {
  records: DerivationRecord[];
  invalid: number;
} {
  const { rows, invalid } = readJsonl(path, (value) => {
    const parsed = DerivationRecordSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  });
  return { records: rows, invalid };
}
