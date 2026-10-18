import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  cachePath,
  createLogger,
  ensureParentDir,
  err,
  errMsg,
  ok,
  type Result,
} from '@senars/util';
import { SenarsError } from '@senars/util/errors';
import type { DriveManager } from '../drives';
import type { Memory } from '../memory';
import type { QueryAPI } from '../query/api.js';
import {
  BOUNDARY_FILENAME,
  type ConsistencyBoundary,
  decodeBoundary,
  encodeBoundary,
} from '../state/boundary.js';
import { decodeState, encodeState, NAR_STATE_SCHEMA_VERSION } from '../state/codec.js';
import { rehydrateTask, serializeTaskRecord, type TaskRecord } from '../task/record.js';
import { termParser } from '../terms';
import type { Task, TaskType } from '../types';
import { type NARConfig, rngBoundaryPort } from './config.js';

/** Task/drive file schema version — the one state schema version (C4.2). */
export const NAR_STATE_VERSION = NAR_STATE_SCHEMA_VERSION;

/** The files a save writes, in one place so "is there state to restore?" is one list. */
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
  pendingTasks(): Task[];
  /** Re-queue restored pending tasks; returns how many were queued. */
  restorePending(records: TaskRecord[]): number;
  /** The id-minting high-water mark at save time. */
  idHighWater(): number;
  /** Prime the id ledger past the saved mark, so a restart never re-stamps an id. */
  primeIdHighWater(count: number): void;
}

/** What a restore resumed, for the `restored` event (CORE.19 C4.6). */
export interface RestoreSummary {
  cycleCount: number;
  pendingRestored: number;
  conceptsRestored: number;
}

/** Deps for NAR state persistence (extracted from NAR — M2). */
export interface StatePersisterDeps {
  config: Pick<NARConfig, 'persistState' | 'statePath' | 'rng'>;
  memory: Memory;
  processor: {
    serializeModelRules(): unknown;
    deserializeModelRules(state: unknown): void;
  };
  driveManager?: DriveManager;
  attentionReport: () => { concepts: unknown[]; total: number };
  /** The one read the save path makes, named off `QueryAPI` itself rather than
   *  re-spelled here — a fourth declaration of the query surface is how the save
   *  path kept calling three of them. */
  query: Pick<QueryAPI, 'getTasksByKind'>;
  /** The kernel boundary the save/restore round-trips (CORE.19 C4.1). */
  boundary?: BoundaryPorts;
  logger?: ReturnType<typeof createLogger>;
}

export class StatePersister {
  private readonly logger: ReturnType<typeof createLogger>;

  constructor(private readonly deps: StatePersisterDeps) {
    this.logger = deps.logger ?? createLogger({ scope: 'NAR.Persistence' });
  }

  private getStatePath(filename: string): string {
    const base = this.deps.config.statePath ?? cachePath('nar-state');
    return path.resolve(base, filename);
  }

  private async readStateFile<T>(filename: string, kind: string): Promise<Result<T | null, Error>> {
    const target = this.getStatePath(filename);
    try {
      const content = await fs.readFile(target, 'utf-8');
      return ok(decodeState<T>(content, kind, NAR_STATE_VERSION));
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return ok(null);
      return err(SenarsError.wrap(e, { path: target, operation: 'readJsonIfExists' }));
    }
  }

  async save(): Promise<void> {
    if (!this.deps.config.persistState) return;
    try {
      const { memory, processor, driveManager, attentionReport, query, boundary } = this.deps;
      const driveStates = driveManager?.getAllStates() ?? [];
      const drives: Record<string, number> = {};
      for (const ds of driveStates) drives[ds.spec.id] = ds.currentIntensity;

      const tasks = query.getTasksByKind();
      const files: Array<[string, string, unknown]> = [
        ['beliefs.json', 'nar.beliefs', tasks.belief.map(serializeTaskRecord)],
        ['goals.json', 'nar.goals', tasks.goal.map(serializeTaskRecord)],
        ['questions.json', 'nar.questions', tasks.question.map(serializeTaskRecord)],
        ['attention.json', 'nar.attention', attentionReport()],
        ['drives.json', 'nar.drives', drives],
        ['lm-rules.json', 'nar.lm-rules', processor.serializeModelRules()],
        [
          BOUNDARY_FILENAME,
          'nar.boundary',
          boundary ? this.#snapshotBoundary(boundary) : undefined,
        ],
      ];

      await ensureParentDir(this.getStatePath(files[0]![0]));
      await Promise.all(
        files
          .filter(([, , data]) => data !== undefined)
          .map(([name, kind, data]) =>
            fs.writeFile(
              this.getStatePath(name),
              name === BOUNDARY_FILENAME
                ? encodeBoundary(data as ConsistencyBoundary)
                : encodeState(kind, NAR_STATE_VERSION, data),
              'utf-8'
            )
          )
      );
    } catch (e) {
      this.logger.warn('NAR state save failed', { error: errMsg(e) });
    }
  }

  #snapshotBoundary(boundary: BoundaryPorts): ConsistencyBoundary {
    const rngState = rngBoundaryPort(this.deps.config.rng).rngState();
    return {
      cycleCount: boundary.getCycleCount(),
      pendingTasks: boundary.pendingTasks().map(serializeTaskRecord),
      idHighWater: boundary.idHighWater(),
      ...(rngState !== undefined ? { rngState } : {}),
    };
  }

  /**
   * Restore the declared boundary (CORE.19 C4.1) and report what resumed. Returns
   * `null` when persistence is off or the save path holds nothing to restore.
   */
  async load(): Promise<RestoreSummary | null> {
    if (!this.deps.config.persistState) return null;
    if (!(await this.#hasState())) return null;
    try {
      const { processor, driveManager } = this.deps;
      const taskFiles: Array<[string, TaskType]> = [
        ['beliefs.json', 'belief'],
        ['goals.json', 'goal'],
        ['questions.json', 'question'],
      ];
      for (const [name, type] of taskFiles) {
        const result = await this.readStateFile<TaskRecord[]>(
          name,
          `nar.${name.slice(0, -'.json'.length)}`
        );
        if (!result.ok) {
          this.logger.warn('NAR state file unreadable', {
            file: name,
            error: errMsg(result.error),
          });
          continue;
        }
        const records = result.value;
        if (!records) continue;
        for (const record of records) {
          const task = rehydrateTask(record, type);
          if (!task) {
            this.logger.warn('Skipping unparseable persisted task', { term: record.term });
            continue;
          }
          this.deps.memory.addTask(task.term, task.type, task.truth, task.budget, task.stamp);
        }
      }

      const conceptsRestored = await this.#restoreAttention();

      const drivesResult = await this.readStateFile<Record<string, number>>(
        'drives.json',
        'nar.drives'
      );
      if (driveManager && drivesResult.ok && drivesResult.value) {
        for (const [driveId, value] of Object.entries(drivesResult.value)) {
          const currentIntensity = driveManager.getState(driveId)?.currentIntensity ?? 0;
          driveManager.stimulate(driveId, Number(value) - currentIntensity);
        }
      }

      const lmRuleResult = await this.readStateFile<{ rules: any[] }>(
        'lm-rules.json',
        'nar.lm-rules'
      );
      if (lmRuleResult.ok && lmRuleResult.value)
        processor.deserializeModelRules(lmRuleResult.value);

      const { cycleCount, pendingRestored } = await this.#restoreBoundary();

      this.logger.info('NAR state loaded');
      return { cycleCount, pendingRestored, conceptsRestored };
    } catch (e) {
      this.logger.warn('NAR state load failed', { error: errMsg(e) });
      return null;
    }
  }

  /**
   * Restore the top-priority concepts the attention surface persisted. The file
   * was written but never read before C4.2; a term that no longer parses is
   * skipped rather than aborting the load.
   */
  async #restoreAttention(): Promise<number> {
    const result = await this.readStateFile<{ concepts: Array<{ term: string; priority: number }> }>(
      'attention.json',
      'nar.attention'
    );
    if (!result.ok || !result.value) return 0;
    let restored = 0;
    for (const { term, priority } of result.value.concepts ?? []) {
      try {
        this.deps.memory.addConcept(termParser.parse(term)).writeAttention({
          reason: 'assign',
          value: priority,
        });
        restored++;
      } catch {
        this.logger.warn('Skipping unparseable persisted concept', { term });
      }
    }
    return restored;
  }

  /** Restore the kernel boundary: cycle counter, pending queue, id high-water. */
  async #restoreBoundary(): Promise<{ cycleCount: number; pendingRestored: number }> {
    const { boundary } = this.deps;
    const text = await this.#readStateText(BOUNDARY_FILENAME);
    if (text === null) return { cycleCount: 0, pendingRestored: 0 };
    const restored = decodeBoundary(text);
    boundary?.setCycleCount(restored.cycleCount);
    boundary?.primeIdHighWater(restored.idHighWater);
    if (restored.rngState !== undefined)
      rngBoundaryPort(this.deps.config.rng).setRngState(restored.rngState);
    return {
      cycleCount: restored.cycleCount,
      pendingRestored: boundary?.restorePending(restored.pendingTasks) ?? 0,
    };
  }

  /** Whether any state file exists — distinguishes a resume from a fresh start. */
  async #hasState(): Promise<boolean> {
    for (const name of STATE_FILENAMES) {
      try {
        await fs.access(this.getStatePath(name));
        return true;
      } catch {
        // absent — keep looking
      }
    }
    return false;
  }

  /** Read a state file's raw text, or `null` when absent. A malformed file throws. */
  async #readStateText(filename: string): Promise<string | null> {
    const target = this.getStatePath(filename);
    try {
      return await fs.readFile(target, 'utf-8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
      throw SenarsError.wrap(e, { path: target, operation: 'readStateText' });
    }
  }
}
