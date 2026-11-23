/**
 * File-based replay compatibility — provides the legacy replay functions
 * that read from JSONL files (gate-events.jsonl, derivations.jsonl).
 *
 * These functions are kept for backward compatibility with the replay CLI
 * and tests. New code should use LogStore-based replay from @senars/log/replay.
 */

import type {
  AutonomyMode,
} from '@senars/schemas/governance';
import type {
  CognitiveEvent,
  TaskAdmittedEvent,
} from '@senars/schemas/cognitive-events';
import {
  CognitiveEventSchema,
  validateCognitiveEvent,
} from '@senars/schemas/cognitive-events';
import {
  DerivationRecordSchema,
  validateDerivationRecord,
  type DerivationRecord,
} from '@senars/schemas/derivation-records';
import type { IdSource } from '@senars/util/id';
import type { RandomSource } from '@senars/util/random';
import type { Clock as UtilClock } from '@senars/util/clock';
import type { Clock } from './env';
import { createDefaultClock } from './env';
import { appendJsonl, readJsonlWith, writeJsonFileSync } from '@senars/util/fs';
import { errMsg } from '@senars/util/error';
import { installIdSource } from '@senars/util/id';
import { keyedBy } from '@senars/util/collections';
import { sha256Hex } from '@senars/util/hash';
import { stableStringify } from '@senars/util/json';
import { createDefaultRegistry, resolveSlot } from '../cognitive/impls/CognitiveRegistry';
import type { CognitiveParameters } from '../config/cognitive-parameters';
import type { Concept, ConceptTaskType, TaskData } from '../memory/concept';
import { Memory } from '../memory/memory';
import type { MemoryPorts } from '../memory/ports/index';
import { serialize as serializeMemory } from '../memory/state/serialization';
import type { ProposalReplayState } from '../proposal/replay';
import { isProposalStream, replayProposalStream } from '../proposal/replay';
import type { AttentionModel } from '../strategies/types';
import { rehydrateTask, type TaskRecord } from '../task/record';
import type { Term } from '../terms/index';
import { Stamp, Truth, termParser, termsEqual } from '../terms/index';
import type { Budget, Timestamp } from '../types/index';
import { NEUTRAL_BUDGET } from '../types/index';
import {
  replayTaskAdmissions,
  type CognitiveStateSnapshot,
  replayCognitiveState,
} from '../log/replay-reducers';
import { createLogger } from '../util/logger';

const logger = createLogger({ scope: 'kernel:replay-compat' });

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
  cognitiveParams?: CognitiveParameters;
  strategyRegistry?: ReturnType<typeof createDefaultRegistry>;
  range?: { from?: number; to?: number };
  idRange?: { from?: string; to?: string };
  ids?: IdSource;
  rng?: RandomSource;
  clock?: Clock;
}

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
  memory: MemoryPorts;
  gateSnapshot: CognitiveStateSnapshot;
  proposalState?: ProposalReplayState;
}

function taskTypeFromEvent(type: TaskAdmittedEvent['payload']['taskType']): ConceptTaskType {
  return type as ConceptTaskType;
}

export async function replayIntoMemory(options: FullReplayOptions): Promise<ReplayResult> {
  const restoreIds = options.ids ? installIdSource(options.ids) : undefined;
  try {
    return await replayWithInjectedEntropy(options);
  } finally {
    restoreIds?.();
  }
}

async function replayWithInjectedEntropy(options: FullReplayOptions): Promise<ReplayResult> {
  const { gateEventsPath, derivationRecordsPath, memoryConfig, range, idRange, rng, clock } =
    options;
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
    } else {
      logger.warn('[replay] ID range not found, falling back to ordinal range');
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
  // Convert kernel Clock (with now/setTime/advance) to util Clock (() => number)
  const utilClock: UtilClock | undefined = clock ? () => clock.now() : undefined;
  const memory = new Memory(
    rng || clock ? { ...memoryConfig, bag: { ...memoryConfig?.bag, rng, clock: utilClock } } : memoryConfig,
    {
      attentionModel: cognitiveParams
        ? resolveSlot<AttentionModel>(
            strategyRegistry ?? createDefaultRegistry(),
            cognitiveParams,
            'attention'
          )
        : undefined,
    }
  );
  const errors: string[] = [];

  const replayed = (label: string, source: string, apply: () => boolean): boolean => {
    try {
      return apply();
    } catch (e) {
      errors.push(`${label} failed: ${source} - ${errMsg(e)}`);
      return false;
    }
  };

  const conceptOf = (narsese: string): [Term, Concept] => {
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
      const record: TaskRecord = {
        term: event.payload.term,
        type: taskTypeFromEvent(event.payload.taskType),
        truth: event.payload.truth ? { f: event.payload.truth.frequency, c: event.payload.truth.confidence } : undefined,
        budget: event.payload.budget?.priority,
        stamp: undefined,
        occurrenceTime: undefined,
      };
      const restored = rehydrateTask(record);
      if (restored) {
        if (
          memory.addTask(restored.term, restored.type, restored.truth, restored.budget, restored.stamp)
        ) {
          appliedTasks++;
        } else {
          skipped++;
        }
      } else {
        skipped++;
      }
    }
  }

  for (const event of gateEvents) {
    if (event.type === 'belief.revised') {
      if (
        replayed('Revision', event.payload.term, () => {
          const [term, concept] = conceptOf(event.payload.term);
          const matching = concept.getBeliefs().find((b) => termsEqual(b.term, term));
          if (!matching) return false;
          concept.beliefBag.remove(matching.id);
          concept.addTask('belief', {
            ...matching,
            truth: Truth.fromUnknown(event.payload.newTruth),
            timestamp: now(),
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
          concept.beliefBag.remove(existing.id);
          concept.addTask('belief', { ...existing, truth, timestamp: now() });
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

export function computeReplayStateHash(
  result: ReplayResult,
  serializedMemory?: ReturnType<typeof serializeMemory>
): string {
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
  outputPath: string,
  clock?: Clock
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
  const canonicalMemory = { ...memorySerialized, timestamp: 0 };
  const snapshot: ReplaySnapshotFile = {
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

export function persistDerivationRecords(
  records: DerivationRecord[],
  path: string
): { appended: number } {
  return { appended: appendJsonl(path, records) };
}

export function loadGateEvents(path: string): { events: CognitiveEvent[]; invalid: number } {
  const { rows, invalid } = readJsonlWith(path, CognitiveEventSchema);
  return { events: rows, invalid };
}

export { replayTaskAdmissions, replayCognitiveState, type CognitiveStateSnapshot } from '../log/replay-reducers';