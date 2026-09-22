import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { DriveManager } from '../drives';
import { createLogger } from '../logger';
import type { Memory } from '../memory';
import { Stamp, Truth, type TruthType, termParser } from '../terms';
import type { Task, TaskType } from '../types';
import { errMsg } from '../utils';
import type { NARConfig } from './config.js';

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

  private async readJsonIfExists<T>(filename: string): Promise<T | null> {
    const target = this.getStatePath(filename);
    try {
      const content = await fs.readFile(target, 'utf-8');
      return JSON.parse(content) as T;
    } catch (e: any) {
      if (e?.code !== 'ENOENT') throw e;
      return null;
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

      const files: Array<[string, unknown]> = [
        ['beliefs.json', query.getBeliefs().map((b) => this.serializeTask(b))],
        ['goals.json', query.getGoals().map((g) => this.serializeTask(g))],
        ['questions.json', query.getQuestions().map((q) => this.serializeTask(q))],
        ['attention.json', attentionReport()],
        ['drives.json', drives],
        ['lm-rules.json', processor.serializeLMRules()],
      ];

      await fs.mkdir(path.dirname(this.getStatePath(files[0]![0])), { recursive: true });
      await Promise.all(
        files.map(([name, data]) =>
          fs.writeFile(this.getStatePath(name), JSON.stringify(data, null, 2), 'utf-8')
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
        const records = await this.readJsonIfExists<any[]>(name);
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

      const drives = await this.readJsonIfExists<Record<string, number>>('drives.json');
      if (driveManager && drives) {
        for (const [driveId, value] of Object.entries(drives)) {
          const currentIntensity = driveManager.getState(driveId)?.currentIntensity ?? 0;
          driveManager.stimulate(driveId, Number(value) - currentIntensity);
        }
      }

      const lmRuleState = await this.readJsonIfExists<{ rules: any[] }>('lm-rules.json');
      if (lmRuleState) processor.deserializeLMRules(lmRuleState);

      this.logger.info('NAR state loaded');
    } catch (e) {
      this.logger.warn('NAR state load failed', { error: errMsg(e) });
    }
  }
}
