/**
 * NAR State Persistence via LogStore — replaces file-based StatePersister.
 *
 * This module persists NAR state (beliefs, goals, questions, attention, drives,
 * lm-rules, boundary) using LogStore snapshots instead of separate JSON files.
 * It provides the same interface as the legacy StatePersister for compatibility.
 */

import type { LogStore } from './store.js';
import { SnapshotManager, createSnapshotManager, type SnapshotConfig } from './snapshot.js';
import { encodeState, decodeState, NAR_STATE_SCHEMA_VERSION } from '../state/codec.js';
import { serializeTaskRecord, rehydrateTask, type TaskRecord } from '../task/record.js';
import { encodeBoundary, decodeBoundary, type ConsistencyBoundary, BOUNDARY_FILENAME } from '../state/boundary.js';
import type { Memory } from '../memory';
import type { DriveManager } from '../drives';
import type { QueryAPI } from '../query/api.js';
import { createLogger } from '@senars/util';
import type { TaskType } from '../types';
import { termParser } from '../terms';

/** Minimal NAR config needed by StatePersister — avoids cycle with nar/src/facade/config. */
interface PersisterNARConfig {
  persistState?: boolean;
  statePath?: string;
  rng?: unknown;
}

const STATE_FILENAMES = [
  'beliefs.json',
  'goals.json',
  'questions.json',
  'attention.json',
  'drives.json',
  'lm-rules.json',
  BOUNDARY_FILENAME,
] as const;

/**
 * The kernel-side operations the persistence boundary round-trips (CORE.19
 * C4.1). The NAR owns the kernel, the queue and the id ledger, so the persister
 * names the one operation it needs of each rather than reaching into them.
 */
export interface BoundaryPorts {
  getCycleCount(): number;
  setCycleCount(count: number): void;
  /** The pending queue at save time. */
  pendingTasks(): any[];
  /** Re-queue restored pending tasks; returns how many were queued. */
  restorePending(records: any[]): number;
  /** The id-minting high-water mark at save time. */
  idHighWater(): number;
  /** Prime the id ledger past the saved mark, so a restart never re-stamps an id. */
  primeIdHighWater(count: number): void;
  /** Get the owned RNG's position word, if any (CORE.19 C4.1). */
  rngState?(): number | undefined;
  /** Set the owned RNG's position word (CORE.19 C4.1). */
  setRngState?(state: number): void;
}

/** What a restore resumed, for the `restored` event (CORE.19 C4.6). */
export interface RestoreSummary {
  cycleCount: number;
  pendingRestored: number;
  conceptsRestored: number;
}

interface StatePersisterDeps {
  config: PersisterNARConfig;
  memory: Memory;
  processor: {
    serializeModelRules(): unknown;
    deserializeModelRules(state: unknown): void;
  };
  driveManager?: DriveManager;
  attentionReport: () => { concepts: Array<{ term: string; priority: number }>; total: number };
  query: Pick<QueryAPI, 'getTasksByKind'>;
  boundary?: BoundaryPorts;
  logger?: ReturnType<typeof createLogger>;
}

/**
 * Combined NAR state for snapshot.
 */
export interface NARStateSnapshot {
  version: number;
  timestamp: number;
  beliefs: TaskRecord[];
  goals: TaskRecord[];
  questions: TaskRecord[];
  attention: { concepts: Array<{ term: string; priority: number }>; total: number };
  drives: Record<string, number>;
  lmRules: unknown;
  boundary: ConsistencyBoundary | null;
}

/**
 * Reducer for NAR state snapshot from events.
 * This builds the state incrementally from the event log.
 */
export function createNARStateReducer(
  deps: StatePersisterDeps
): (state: NARStateSnapshot, event: any, entry: any) => NARStateSnapshot {
  const { memory, processor, driveManager, attentionReport, query, boundary } = deps;

  return (state, event) => {
    const newState = { ...state };

    switch (event.type) {
      case 'task.admitted': {
        const term = event.payload.term ?? '';
        const record: TaskRecord = {
          term,
          type: event.payload.taskType,
          truth: event.payload.truth ? { f: event.payload.truth.f, c: event.payload.truth.c } : undefined,
          budget: event.payload.budget?.priority,
          stamp: event.payload.stamp,
          occurrenceTime: event.payload.occurrenceTime,
        };
        switch (event.payload.taskType) {
          case 'belief':
            newState.beliefs.push(record);
            break;
          case 'goal':
            newState.goals.push(record);
            break;
          case 'question':
            newState.questions.push(record);
            break;
        }
        break;
      }
      case 'belief.revised': {
        // Update belief truth in state
        const idx = newState.beliefs.findIndex(b => b.term === event.payload.term);
        if (idx >= 0 && event.payload.newTruth) {
          const existing = newState.beliefs[idx]!;
          newState.beliefs[idx] = {
            term: existing.term,
            type: existing.type,
            truth: { f: event.payload.newTruth.f, c: event.payload.newTruth.c },
            budget: existing.budget,
            stamp: existing.stamp,
            occurrenceTime: existing.occurrenceTime,
          };
        }
        break;
      }
      case 'concept.activated': {
        // Update attention
        const term = event.payload.term ?? '';
        const existing = newState.attention.concepts.findIndex(c => c.term === term);
        if (existing >= 0) {
          newState.attention.concepts[existing] = { term, priority: event.payload.priority };
        } else {
          newState.attention.concepts.push({ term, priority: event.payload.priority });
        }
        break;
      }
      case 'drive.stimulated': {
        newState.drives[event.payload.driveId] = event.payload.newIntensity;
        break;
      }
      case 'lm.rule.admitted': {
        // LM rules are serialized separately
        break;
      }
      case 'proposal.admitted':
      case 'proposal.rejected': {
        if (boundary) {
          newState.boundary = {
            ...newState.boundary,
            cycleCount: boundary.getCycleCount(),
            pendingTasks: boundary.pendingTasks().map(serializeTaskRecord),
            idHighWater: boundary.idHighWater(),
          } as any;
        }
        break;
      }
    }

    return newState;
  };
}

/**
 * Initial empty NAR state.
 */
export const emptyNARState = (): NARStateSnapshot => ({
  version: NAR_STATE_SCHEMA_VERSION,
  timestamp: Date.now(),
  beliefs: [],
  goals: [],
  questions: [],
  attention: { concepts: [], total: 0 },
  drives: {},
  lmRules: null,
  boundary: null,
});

/**
 * LogStore-based NAR State Persister.
 * Replaces the file-based StatePersister with LogStore snapshots.
 */
export class LogStoreStatePersister {
  private store: LogStore;
  private snapshotManager: SnapshotManager<NARStateSnapshot>;
  private deps: StatePersisterDeps;
  private logger: ReturnType<typeof createLogger>;

  constructor(store: LogStore, deps: StatePersisterDeps) {
    this.store = store;
    this.deps = deps;
    this.logger = deps.logger ?? createLogger({ scope: 'NAR.LogStorePersistence' });

    // Create snapshot manager with NAR state reducer
    const reducer = createNARStateReducer(deps);
    this.snapshotManager = createSnapshotManager(reducer, emptyNARState(), {
      dir: deps.config.statePath ? `${deps.config.statePath}/snapshots` : 'data/snapshots/nar',
      interval: 10000,
      maxSnapshots: 10,
      compress: false,
    });
  }

  /**
   * Save current NAR state as a snapshot.
   */
  async save(): Promise<void> {
    if (!this.deps.config.persistState) return;

    try {
      const { memory, processor, driveManager, attentionReport, query, boundary } = this.deps;

      // Build current state
      const driveStates = driveManager?.getAllStates() ?? [];
      const drives: Record<string, number> = {};
      for (const ds of driveStates) drives[ds.spec.id] = ds.currentIntensity;

      const tasks = query.getTasksByKind();
      const beliefs = tasks.belief.map(serializeTaskRecord);
      const goals = tasks.goal.map(serializeTaskRecord);
      const questions = tasks.question.map(serializeTaskRecord);
      const attention = attentionReport();
      const lmRules = processor.serializeModelRules();
      const boundaryData = boundary ? this.#snapshotBoundary(boundary) : null;

      const state: NARStateSnapshot = {
        version: NAR_STATE_SCHEMA_VERSION,
        timestamp: Date.now(),
        beliefs,
        goals,
        questions,
        attention,
        drives,
        lmRules,
        boundary: boundaryData,
      };

      // Create snapshot at current log head with pre-built state
      await this.snapshotManager.saveStateAtHead(this.store, state, { savedAt: state.timestamp });
      this.logger.info('NAR state saved via LogStore snapshot');
    } catch (e) {
      this.logger.warn('NAR state save failed', { error: e });
    }
  }

  /**
   * Load NAR state from the latest snapshot and replay events.
   */
  async load(): Promise<RestoreSummary | null> {
    if (!this.deps.config.persistState) return null;

    try {
      // Restore from latest snapshot and replay
      const result = await this.snapshotManager.restoreLatest();

      if (!result) {
        this.logger.info('No NAR state snapshot found');
        return null;
      }

      const { state: snapshot, seq } = result;
      this.logger.info('NAR state snapshot restored', { seq, timestamp: snapshot.timestamp });

      // Replay events from snapshot to current head
      const { replay } = await import('./replay.js');
      const reducer = createNARStateReducer(this.deps);

      await replay(this.store, {
        initialState: snapshot,
        reducer,
        fromSeq: seq + 1,
      });

      // Apply restored state to NAR components
      return await this.#applyRestoredState(snapshot);
    } catch (e) {
      this.logger.warn('NAR state load failed', { error: e });
      return null;
    }
  }

  async #applyRestoredState(snapshot: NARStateSnapshot): Promise<RestoreSummary> {
    const { memory, processor, driveManager, boundary } = this.deps;

    // Restore tasks
    const taskFiles: Array<[TaskRecord[], TaskType]> = [
      [snapshot.beliefs, 'belief'],
      [snapshot.goals, 'goal'],
      [snapshot.questions, 'question'],
    ];

    let pendingRestored = 0;
    for (const [records, type] of taskFiles) {
      for (const record of records) {
        const task = rehydrateTask(record, type);
        if (!task) continue;
        memory.addTask(task.term, task.type, task.truth, task.budget, task.stamp);
        if (type === 'belief' || type === 'goal' || type === 'question') {
          pendingRestored++;
        }
      }
    }

    // Restore attention
    let conceptsRestored = 0;
    for (const { term, priority } of snapshot.attention.concepts ?? []) {
      try {
        memory.addConcept(termParser.parse(term)).writeAttention({
          reason: 'assign',
          value: priority,
        });
        conceptsRestored++;
      } catch {
        this.logger.warn('Skipping unparseable persisted concept', { term });
      }
    }

    // Restore drives
    if (driveManager && snapshot.drives) {
      for (const [driveId, value] of Object.entries(snapshot.drives)) {
        const currentIntensity = driveManager.getState(driveId)?.currentIntensity ?? 0;
        driveManager.stimulate(driveId, Number(value) - currentIntensity);
      }
    }

    // Restore LM rules
    if (snapshot.lmRules) {
      processor.deserializeModelRules(snapshot.lmRules);
    }

    // Restore boundary
    let cycleCount = 0;
    if (boundary && snapshot.boundary) {
      boundary.setCycleCount(snapshot.boundary.cycleCount);
      boundary.primeIdHighWater(snapshot.boundary.idHighWater);
      cycleCount = snapshot.boundary.cycleCount;
      pendingRestored = boundary.restorePending(snapshot.boundary.pendingTasks);
      if (snapshot.boundary.rngState !== undefined && boundary.setRngState) {
        boundary.setRngState(snapshot.boundary.rngState);
      }
    }

    this.logger.info('NAR state loaded from LogStore', { cycleCount, pendingRestored, conceptsRestored });
    return { cycleCount, pendingRestored, conceptsRestored };
  }

  #snapshotBoundary(boundary: BoundaryPorts): ConsistencyBoundary {
    const rngState = boundary.rngState?.();
    return {
      cycleCount: boundary.getCycleCount(),
      pendingTasks: boundary.pendingTasks().map(serializeTaskRecord),
      idHighWater: boundary.idHighWater(),
      ...(rngState !== undefined ? { rngState } : {}),
    };
  }

  async close(): Promise<void> {
    await this.snapshotManager.list(); // Ensure any pending writes complete
  }
}

/**
 * Create a LogStoreStatePersister.
 */
export function createLogStoreStatePersister(
  store: LogStore,
  deps: StatePersisterDeps
): LogStoreStatePersister {
  return new LogStoreStatePersister(store, deps);
}