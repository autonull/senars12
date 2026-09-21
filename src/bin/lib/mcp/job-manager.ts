/**
 * Fire-and-forget background jobs (NAR cycles, research tasks). Tracked
 * in-process with bounded history (AIKR); surfaced via `nar://jobs` and
 * the `job_status` tool.
 */

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

export class JobManager {
  readonly #jobs = new Map<string, JobRecord>();
  readonly #capacity: number;
  #nextId = 0;

  constructor(capacity = 100) {
    this.#capacity = capacity;
  }

  submit(kind: string, fn: () => Promise<unknown> | unknown): string {
    const id = `job-${++this.#nextId}`;
    const record: JobRecord = { id, kind, status: 'running', startedAt: Date.now() };
    this.#remember(record);
    void (async () => {
      try {
        record.result = await fn();
        record.status = 'done';
      } catch (e) {
        record.status = 'error';
        record.error = (e as Error).message;
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
    return [...this.#jobs.values()];
  }

  #remember(record: JobRecord): void {
    this.#jobs.set(record.id, record);
    // bounded: evict oldest finished records when over capacity
    if (this.#jobs.size > this.#capacity) {
      for (const [key, job] of this.#jobs) {
        if (job.status !== 'running') {
          this.#jobs.delete(job.id);
          if (this.#jobs.size <= this.#capacity) break;
        }
      }
    }
  }
}
