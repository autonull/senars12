import { promises as fs } from 'node:fs';
import path from 'node:path';
import { SenarsError } from '@senars/util/errors';
import type { DriveManager } from '../drives';
import { createLogger } from '../logger';
import type { Memory } from '../memory';
import { Stamp, Truth, type TruthType, termParser } from '../terms';
import type { Task, TaskType } from '../types';
import { errMsg } from '../utils';
import { err, ok, type Result } from '../utils/result.js';
import { decodeState, encodeState } from '../state/codec.js';
import type { NARConfig } from './config.js';

/** Snapshot envelope version (StateCodec, TODO20 X7). */
export const NAR_STATE_VERSION = 1;

/** Deps for NAR state persistence (extracted from NAR — M2). */
export interface StatePersisterDeps {
  config: Pick<NARConfig, 'persistState' | 'statePath'>;
  memory: Memory;
  processor: {
    serializeLMRules(): unknown;
    deserializeLMRules(state: unknown): void;
  };
  driveManager?: DriveManager;
  attentionReport: () => { concepts: unknown[]; total: number };
  query: {
    getBeliefs(): Task[];
    getGoals(): Task[];
    getQuestions(): Task[];
  };
  logger?: ReturnType<typeof createLogger>;
}

export class StatePersister {
  private readonly logger: ReturnType<typeof createLogger>;

  constructor(private readonly deps: StatePersisterDeps) {
    this.logger = deps.logger ?? createLogger({ scope: 'NAR.Persistence' });
  }

  private getStatePath(filename: string): string {
    const base = this.deps.config.statePath ?? '.cache/nar-state';
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

  private serializeTask(task: Task) {
    return {
      term: task.term.toString(),
      type: task.type,
      truth: task.truth ? Truth.create(task.truth.f, task.truth.c) : undefined,
      stamp: task.stamp,
    };
  }

  private rehydrateTask(
    record: { term: string; type?: TaskType; truth?: TruthType; stamp?: any },
    type: TaskType
  ) {
    const punctuation =
      (record.type ?? type) === 'belief' ? '.' : (record.type ?? type) === 'goal' ? '!' : '?';
    const parsed = termParser.parse(`${record.term}${punctuation}`);
    return (
      parsed && {
        term: parsed,
        type: record.type ?? type,
        truth: record.truth ?? Truth.NEUTRAL,
        budget: { priority: 0.5, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
        stamp: record.stamp ?? Stamp.createInput(),
        occurrenceTime: Date.now() as any,
        derived: false,
      }
    );
  }

  async save(): Promise<void> {
    if (!this.deps.config.persistState) return;
    try {
      const { memory, processor, driveManager, attentionReport, query } = this.deps;
      const driveStates = driveManager?.getAllStates() ?? [];
      const drives: Record<string, number> = {};
      for (const ds of driveStates) drives[ds.spec.id] = ds.currentIntensity;

      const files: Array<[string, string, unknown]> = [
        ['beliefs.json', 'nar.beliefs', query.getBeliefs().map((b) => this.serializeTask(b))],
        ['goals.json', 'nar.goals', query.getGoals().map((g) => this.serializeTask(g))],
        ['questions.json', 'nar.questions', query.getQuestions().map((q) => this.serializeTask(q))],
        ['attention.json', 'nar.attention', attentionReport()],
        ['drives.json', 'nar.drives', drives],
        ['lm-rules.json', 'nar.lm-rules', processor.serializeLMRules()],
      ];

      await fs.mkdir(path.dirname(this.getStatePath(files[0]![0])), { recursive: true });
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
        const result = await this.readStateFile<any[]>(name, `nar.${name.slice(0, -'.json'.length)}`);
        if (!result.ok) {
          this.logger.warn('NAR state file unreadable', { file: name, error: errMsg(result.error) });
          continue;
        }
        const records = result.value;
        if (!records) continue;
        for (const record of records) {
          try {
            const task = this.rehydrateTask(record, type);
            if (task) memory.addTask(task.term, task.type, task.truth, task.budget);
          } catch (e) {
            this.logger.warn('Skipping unparseable persisted task', { error: errMsg(e) });
          }
        }
      }

      const drivesResult = await this.readStateFile<Record<string, number>>('drives.json', 'nar.drives');
      if (driveManager && drivesResult.ok && drivesResult.value) {
        for (const [driveId, value] of Object.entries(drivesResult.value)) {
          const currentIntensity = driveManager.getState(driveId)?.currentIntensity ?? 0;
          driveManager.stimulate(driveId, Number(value) - currentIntensity);
        }
      }

      const lmRuleResult = await this.readStateFile<{ rules: any[] }>('lm-rules.json', 'nar.lm-rules');
      if (lmRuleResult.ok && lmRuleResult.value) processor.deserializeLMRules(lmRuleResult.value);

      this.logger.info('NAR state loaded');
    } catch (e) {
      this.logger.warn('NAR state load failed', { error: errMsg(e) });
    }
  }
}
