/**
 * Fire-and-forget background jobs (NAR cycles, research tasks). Tracked
 * in-process with bounded history (AIKR); surfaced via `nar://jobs` and
 * the `job_status` tool.
 */

import { BoundedMap, errMsg } from '@senars/util';

export type JobStatus = 'running' | 'done' | 'error';

export interface JobRecord {
  id: string;
  kind: string;
  status: JobStatus;
  startedAt: number;
  finishedAt?: number;
  result?: unknown;
  error?: string;
}

/**
 * A running job is worth more than any finished one, so it scores `Infinity` and
 * is evicted last. `BoundedMap` evicts the *lowest* score, so the oldest finished
 * record goes first and a job that is still working is never shed — including when
 * every entry is running, in which case nothing scores below `Infinity` and the
 * map is allowed to sit above capacity rather than cancel work in flight.
 */
const evictionCost = (job: JobRecord): number =>
  job.status === 'running' ? Number.POSITIVE_INFINITY : job.startedAt;

export class JobManager {
  readonly #jobs: BoundedMap<string, JobRecord>;
  #nextId = 0;

  constructor(capacity = 100) {
    this.#jobs = new BoundedMap({ maxSize: capacity, eviction: { by: evictionCost } });
  }

  submit(kind: string, fn: () => Promise<unknown> | unknown): string {
    const id = `job-${++this.#nextId}`;
    const record: JobRecord = { id, kind, status: 'running', startedAt: Date.now() };
    this.#jobs.set(id, record);
    void (async () => {
      try {
        record.result = await fn();
        record.status = 'done';
      } catch (e) {
        record.status = 'error';
        record.error = errMsg(e);
      } finally {
        record.finishedAt = Date.now();
      }
    })();
    return id;
  }

  get(id: string): JobRecord | undefined {
    return this.#jobs.get(id);
  }

  list(): JobRecord[] {
    return this.#jobs.toArray();
  }
}
