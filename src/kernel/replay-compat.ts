/**
 * File-based replay compatibility — provides the legacy replay functions
 * that read from JSONL files (gate-events.jsonl, derivations.jsonl).
 *
 * These functions are kept for backward compatibility with the replay CLI
 * and tests. New code should use LogStore-based replay from @senars/log/replay.
 */

import type {
  AutonomyMode,
} from '@senars/schemas/governance.js';
import type {
  CognitiveEvent,
  DerivationRecordEvent,
  TaskAdmittedEvent,
} from '@senars/schemas/cognitive-events.js';
import {
  CognitiveEventSchema,
  validateCognitiveEvent,
} from '@senars/schemas/cognitive-events.js';
import {
  DerivationRecordSchema,
  validateDerivationRecord,
} from '@senars/schemas/derivation-records.js';
import type { IdSource } from '@senars/util/id.js';
import type { RandomSource } from '@senars/util/random.js';
import type { Clock } from '@senars/util/clock.js';
import { appendJsonl, readJsonlWith, writeJsonFileSync } from '@senars/util/fs';
import { errMsg } from '@senars/util/error';
import { installIdSource } from '@senars/util/id';
import { keyedBy } from '@senars/util/collections';
import { sha256Hex } from '@senars/util/hash';
import { stableStringify } from '@senars/util/json';
import { createDefaultRegistry, resolveSlot } from '../cognitive/impls/CognitiveRegistry.js';
import type { CognitiveParameters } from '../config/cognitive-parameters.js';
import type { Concept, ConceptTaskType, TaskData } from '../memory/concept.js';
import { Memory } from '../memory/memory.js';
import type { MemoryPorts } from '../memory/ports/index.js';
import { serialize as serializeMemory } from '../memory/state/serialization.js';
import type { ProposalReplayState } from '../proposal/replay.js';
import { isProposalStream, replayProposalStream } from '../proposal/replay.js';
import type { AttentionModel } from '../strategies/types.js';
import { rehydrateTask, type TaskRecord } from '../task/record.js';
import type { Term } from '../terms/index.js';
import { Stamp, Truth, termParser, termsEqual } from '../terms/index.js';
import type { Budget, Timestamp } from '../types/index.js';
import { NEUTRAL_BUDGET } from '../types/index.js';

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
  gateSnapshot: ReturnType<typeof replayCognitiveState>;
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
  const now = clock ?? Date.now;

  const { events: allGateEvents, invalid: gateInvalid } = loadGateEvents(gateEventsPath);
  if (gateInvalid > 0) {
    console.warn(`[replay] ${gateInvalid} invalid gate events skipped`);
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

  const derivationRecords: DerivationRecordEvent[] = derivationRecordsPath
    ? readJsonlWith(derivationRecordsPath, DerivationRecordSchema).rows
    : [];

  const { cognitiveParams, strategyRegistry } = options;
  const memory = new Memory(
    rng || clock ? { ...memoryConfig, bag: { ...memoryConfig?.bag, rng, clock } } : memoryConfig,
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
  records: DerivationRecordEvent[],
  path: string
): { appended: number } {
  return { appended: appendJsonl(path, records) };
}

export function loadGateEvents(path: string): { events: CognitiveEvent[]; invalid: number } {
  const { rows, invalid } = readJsonlWith(path, CognitiveEventSchema);
  return { events: rows, invalid };
}

export function replayTaskAdmissions(
  events: CognitiveEvent[]
): Array<TaskAdmittedEvent['payload']> {
  return events
    .filter((e) => e.type === 'task.admitted')
    .map((e) => (e as TaskAdmittedEvent).payload);
}

export const SNAPSHOT_VERSION = 2;

export interface CognitiveStateSnapshot {
  version: number;
  tasks: Array<{
    term: string;
    taskType: string;
    truth?: { frequency: number; confidence: number };
  }>;
  beliefs: Record<string, { frequency: number; confidence: number }>;
  revisions: Record<
    string,
    Array<{
      oldTruth: { frequency: number; confidence: number };
      newTruth: { frequency: number; confidence: number };
    }>
  >;
  derivations: Array<{
    derivationId: string;
    ruleId: string;
    conclusion: string;
    truth: { frequency: number; confidence: number };
  }>;
  priorities: Record<string, number>;
  violations: Array<{ policyId: string; violationType: string; severity: string }>;
  budgets: Array<{ budgetType: string; terminationReason: string }>;
  autonomyMode: AutonomyMode | null;
  proposals: {
    revision: number;
    admissions: Array<{
      proposalId: string;
      kind: 'content' | 'rule';
      baseRevision: number;
      resultingRevision: number;
      producer?: string;
    }>;
    rejections: Array<{
      proposalId: string;
      kind: 'content' | 'rule';
      reason: string;
      observedRevision: number;
    }>;
  };
}

const emptySnapshot = (): CognitiveStateSnapshot => ({
  version: SNAPSHOT_VERSION,
  tasks: [],
  beliefs: {},
  revisions: {},
  derivations: [],
  priorities: {},
  violations: [],
  budgets: [],
  autonomyMode: null,
  proposals: { revision: 0, admissions: [], rejections: [] },
});

export function replayCognitiveState(events: CognitiveEvent[]): CognitiveStateSnapshot {
  const state = emptySnapshot();
  for (const event of events) {
    switch (event.type) {
      case 'task.admitted':
        state.tasks.push({
          term: event.payload.term,
          taskType: event.payload.taskType,
          truth: event.payload.truth,
        });
        break;
      case 'belief.revised': {
        state.beliefs[event.payload.term] = { ...event.payload.newTruth };
        const chain = state.revisions[event.payload.term] ?? [];
        chain.push({
          oldTruth: { ...event.payload.oldTruth },
          newTruth: { ...event.payload.newTruth },
        });
        state.revisions[event.payload.term] = chain;
        break;
      }
      case 'derivation.accepted':
        state.derivations.push({
          derivationId: event.payload.derivationId,
          ruleId: event.payload.ruleId,
          conclusion: event.payload.conclusion,
          truth: { ...event.payload.truth },
        });
        break;
      case 'concept.activated':
        state.priorities[event.payload.term] = event.payload.priority;
        break;
      case 'policy.violation':
        state.violations.push({ ...event.payload });
        break;
      case 'budget.exhausted':
        state.budgets.push({
          budgetType: event.payload.budgetType,
          terminationReason: event.payload.terminationReason,
        });
        break;
      case 'autonomy.mode.changed':
        state.autonomyMode = event.payload.newMode;
        break;
      case 'proposal.admitted':
        state.proposals.admissions.push({
          proposalId: event.payload.proposalId,
          kind: event.payload.kind,
          baseRevision: event.payload.baseRevision,
          resultingRevision: event.payload.resultingRevision,
          producer: event.payload.producer,
        });
        state.proposals.revision = event.payload.resultingRevision;
        break;
      case 'proposal.rejected':
        state.proposals.rejections.push({
          proposalId: event.payload.proposalId,
          kind: event.payload.kind,
          reason: event.payload.reason,
          observedRevision: event.payload.observedRevision,
        });
        break;
    }
  }
  return state;
}