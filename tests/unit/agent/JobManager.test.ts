import { describe, expect, it } from 'vitest';
import { JobManager } from '../../../src/bin/lib/mcp/job-manager.js';

describe('JobManager', () => {
  it('tracks a job through running to done with its result', async () => {
    const jm = new JobManager();
    const id = jm.submit('nar-cycles', () => 'result-value');
    expect(jm.get(id)?.status).toBe('running');
    await new Promise((r) => setTimeout(r, 10));
    const job = jm.get(id);
    expect(job?.status).toBe('done');
    expect(job?.result).toBe('result-value');
    expect(job?.finishedAt).toBeGreaterThan(0);
  });

  it('records errors without throwing', async () => {
    const jm = new JobManager();
    const id = jm.submit('belief', async () => {
      throw new Error('boom');
    });
    await new Promise((r) => setTimeout(r, 10));
    const job = jm.get(id);
    expect(job?.status).toBe('error');
    expect(job?.error).toBe('boom');
  });

  it('lists jobs and evicts finished records beyond capacity', async () => {
    const jm = new JobManager(3);
    for (let i = 0; i < 5; i++) {
      jm.submit('belief', () => i);
      await new Promise((r) => setTimeout(r, 1));
    }
    expect(jm.list().length).toBeLessThanOrEqual(3);
  });

  it('never sheds a running job, and sheds the oldest finished one first', async () => {
    const jm = new JobManager(2);
    const settle = () => new Promise((r) => setTimeout(r, 1));

    const held = jm.submit('held', () => new Promise(() => {}));
    await settle();
    const first = jm.submit('belief', () => 'a');
    await settle();
    const second = jm.submit('belief', () => 'b');
    await settle();
    const third = jm.submit('belief', () => 'c');
    await settle();

    expect(jm.get(held)?.status).toBe('running');
    expect(jm.list().map((job) => job.id)).toEqual([held, third]);
    expect(jm.get(first)).toBeUndefined();
    expect(jm.get(second)).toBeUndefined();
  });
});
