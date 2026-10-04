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
import { decodeState, encodeState } from '../state/codec.js';
import { rehydrateTask, serializeTaskRecord, type TaskRecord } from '../task/record.js';
import type { TaskType } from '../types';
import type { NARConfig } from './config.js';

/** Snapshot envelope version (StateCodec, TODO20 X7). */
export const NAR_STATE_VERSION = 1;

/** Deps for NAR state persistence (extracted from NAR — M2). */
export interface StatePersisterDeps {
  config: Pick<NARConfig, 'persistState' | 'statePath'>;
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
      const { memory, processor, driveManager, attentionReport, query } = this.deps;
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
      ];

      await ensureParentDir(this.getStatePath(files[0]![0]));
      await Promise.all(
        files.map(([name, kind, data]) =>
          fs.writeFile(this.getStatePath(name), encodeState(kind, NAR_STATE_VERSION, data), 'utf-8')
        )
      );
    } catch (e) {
      this.logger.warn('NAR state save failed', { error: errMsg(e) });
    }
  }

  async load(): Promise<void> {
    if (!this.deps.config.persistState) return;
    try {
      const { memory, processor, driveManager } = this.deps;
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
          memory.addTask(task.term, task.type, task.truth, task.budget, task.stamp);
        }
      }

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

      this.logger.info('NAR state loaded');
    } catch (e) {
      this.logger.warn('NAR state load failed', { error: errMsg(e) });
    }
  }
}
