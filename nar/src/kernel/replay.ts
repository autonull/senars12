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
import {
  appendJsonl,
  errMsg,
  keyedBy,
  readJsonlWith,
  sha256Hex,
  stableStringify,
  writeJsonFileSync,
} from '@senars/util';
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
import type { Term } from '../terms/index.js';
import { Stamp, Truth, termParser, termsEqual } from '../terms/index.js';
import type { Budget, Timestamp } from '../types/index.js';
import { NEUTRAL_BUDGET } from '../types/index.js';
import {
  loadGateEvents,
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

/** What a replay applied, and what it could not. The one tally of both. */
export interface ReplayTally {
  appliedTasks: number;
  appliedRevisions: number;
  appliedDerivations: number;
  appliedActivations: number;
  appliedProposals: number;
  skipped: number;
  errors: string[];
}

export interface ReplayResult extends ReplayTally {
  /** The reconstructed store, as a port: replay reads it, it does not own it. */
  memory: MemoryPorts;
  gateSnapshot: ReturnType<typeof replayCognitiveState>;
  /**
   * A9: the proposal seam's own reduction, from the same log. `undefined` for a
   * log with no `proposal.*` events, so a caller can tell "no proposals were
   * recorded" from "there was nothing to reduce".
   */
  proposalState?: ProposalReplayState;
}

function taskTypeFromEvent(type: TaskAdmittedEvent['payload']['taskType']): ConceptTaskType {
  return type as ConceptTaskType;
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
    ? readJsonlWith(derivationRecordsPath, DerivationRecordSchema).rows
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

  /**
   * Apply one replayed item and report whether it took. A term that will not
   * parse and a write that throws are both a *skipped item*, not a failed replay,
   * which is why the answer is a boolean rather than a throw — the caller counts
   * "not applied" for the same reason either way, and reports only the throw.
   *
   * Three loops each opened with this same `try`/`catch` around a `parse` and a
   * get-or-create, and the only parts that differed were the label they reported
   * and the counter they incremented.
   */
  const replayed = (label: string, source: string, apply: () => boolean): boolean => {
    try {
      return apply();
    } catch (e) {
      errors.push(`${label} failed: ${source} - ${errMsg(e)}`);
      return false;
    }
  };

  /** Parse a replayed term and find-or-create its concept. `addConcept` is
   *  already the get-or-create, so the `getConcept(term) ?? addConcept(term)` each
   *  of those loops opened with was a synonym that read as two steps. */
  const conceptOf = (narsese: string): [Term, Concept] => {
    const term = termParser.parse(narsese);
    return [term, memory.addConcept(term)];
  };

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
      if (
        replayed('Revision', event.payload.term, () => {
          const [term, concept] = conceptOf(event.payload.term);
          const matching = concept.getBeliefs().find((b) => termsEqual(b.term, term));
          if (!matching) return false;
          // Remove first: `addTask` merges a revision, and a replay must install
          // the recorded truth rather than re-derive one from it.
          concept.beliefBag.remove(matching);
          concept.addTask('belief', {
            ...matching,
            truth: Truth.fromUnknown(event.payload.newTruth),
            timestamp: Date.now(),
          });
          return true;
        })
      ) {
        appliedRevisions++;
      } else {
        skipped++;
      }
    } else if (event.type === 'concept.activated') {
      if (
        replayed('Activation', event.payload.term, () => {
          conceptOf(event.payload.term)[1].writeAttention({
            reason: 'assign',
            value: event.payload.priority,
          });
          return true;
        })
      ) {
        appliedActivations++;
      } else {
        skipped++;
      }
    }
  }

  for (const record of derivationRecords) {
    for (const step of record.steps) {
      if (
        replayed('Derivation step', step.conclusion, () => {
          const [term, concept] = conceptOf(step.conclusion);
          const existing = concept.getBeliefs().find((b) => termsEqual(b.term, term));
          const truth = Truth.fromUnknown(step.truth);
          if (!existing) {
            const parent = Stamp.createInput();
            const parents =
              step.evidenceLineage.length > 0
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
          if (step.independence === 'unknown') return false;
          concept.beliefBag.remove(existing);
          concept.addTask('belief', { ...existing, truth, timestamp: Date.now() });
          return true;
        })
      ) {
        appliedDerivations++;
      } else {
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
] as const satisfies readonly (keyof ReplayResult)[];

/**
 * Deterministic content hash of a replay outcome — the C14 replay verification token.
 * `serializedMemory` is the caller's own serialization: writing a snapshot already
 * holds one, and serializing the store again is a full walk of every concept and
 * every task in each of its three bags.
 */
export function computeReplayStateHash(
  result: ReplayResult,
  serializedMemory?: ReturnType<typeof serializeMemory>
): string {
  // Canonicalize: drop the timestamp so the hash is deterministic across runs.
  const canonicalMemory = { ...(serializedMemory ?? serializeMemory(result.memory)), timestamp: 0 };
  return sha256Hex(
    stableStringify({
      counters: keyedBy(
        HASHED_FIELDS,
        (field) => field,
        (field) => result[field]
      ),
      memory: canonicalMemory,
    })
  );
}

export function verifyReplayStateHash(
  result: ReplayResult,
  expectedHash: string
): { valid: boolean; actual: string } {
  const actual = computeReplayStateHash(result);
  return { valid: actual === expectedHash, actual };
}

export interface ReplaySnapshotFile {
  version: number;
  timestamp: number;
  stateHash: string;
  gateSnapshot: ReplayResult['gateSnapshot'];
  proposalState?: ProposalReplayState;
  memory: unknown;
  stats: ReplayTally;
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

export function persistDerivationRecords(
  records: DerivationRecord[],
  path: string
): { appended: number } {
  return { appended: appendJsonl(path, records) };
}
