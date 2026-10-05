import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { boundedDeadline, TimeoutError, withDeadline } from '@senars/util';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../../..');

/** A promise that never settles, for asserting the deadline is what resolves. */
const never = <T>(): Promise<T> => new Promise<T>(() => {});

/** Let the event loop drain enough for a short timer to have fired if it were armed. */
const settle = (ms = 25): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('boundedDeadline', () => {
  it('aborts the signal and rejects when the deadline elapses', async () => {
    const { signal, expired, dispose } = boundedDeadline(5);
    expect(signal.aborted).toBe(false);
    await expect(expired).rejects.toBeInstanceOf(TimeoutError);
    expect(signal.aborted).toBe(true);
    dispose();
  });

  it('carries the supplied error, so a domain can say what ran out', async () => {
    class JudgingDeadline extends TimeoutError {
      constructor(
        readonly rubric: string,
        ms: number
      ) {
        super(ms);
      }
    }
    const { expired, dispose } = boundedDeadline(5, () => new JudgingDeadline('groundedness', 5));
    await expect(expired).rejects.toMatchObject({ rubric: 'groundedness', timeoutMs: 5 });
    dispose();
  });

  it('never settles once disposed, and disposing twice is a no-op', async () => {
    const { expired, dispose } = boundedDeadline(5);
    dispose();
    dispose();
    const outcome = await Promise.race([
      expired.then(
        () => 'settled',
        () => 'settled'
      ),
      settle(20),
    ]);
    expect(outcome).not.toBe('settled');
  });
});

describe('withDeadline', () => {
  it('hands the work a signal tied to the same deadline', async () => {
    let seen: AbortSignal | undefined;
    const value = await withDeadline((signal) => {
      seen = signal;
      return Promise.resolve('ok');
    }, 50);
    expect(value).toBe('ok');
    expect(seen?.aborted).toBe(false);
  });

  it('rejects with the timeout error rather than resolving a sentinel', async () => {
    await expect(withDeadline(() => never<string>(), 5)).rejects.toBeInstanceOf(TimeoutError);
  });

  it('aborts the work when the deadline wins, not merely stops waiting for it', async () => {
    // The distinction the signal exists for: a callee that ignores the deadline is
    // still bounded, and one that honours it stops costing anything.
    let aborted = false;
    const outcome = await withDeadline((signal) => {
      signal.addEventListener('abort', () => {
        aborted = true;
      });
      return never<string>();
    }, 5).catch(() => 'deadline' as const);
    expect(outcome).toBe('deadline');
    expect(aborted).toBe(true);
  });

  it('disposes the timer when the work throws before returning a promise', async () => {
    let signal: AbortSignal | undefined;
    expect(() =>
      withDeadline((s) => {
        signal = s;
        throw new Error('bad request shape');
      }, 10)
    ).toThrow('bad request shape');
    await settle();
    // A synchronous throw must not leave the deadline armed: it would abort a
    // signal the caller still holds, or reject with nothing listening.
    expect(signal?.aborted).toBe(false);
  });

  it("surfaces the callee's own rejection unchanged", async () => {
    const fault = new Error('provider down');
    await expect(withDeadline(() => Promise.reject(fault), 50)).rejects.toBe(fault);
  });

  it('releases the timer when the work wins, so the deadline cannot fire afterwards', async () => {
    // The disposal is observable through the work's own signal: a deadline left
    // armed would abort a signal the caller is still holding.
    let signal: AbortSignal | undefined;
    const value = await withDeadline((s) => {
      signal = s;
      return Promise.resolve('fast');
    }, 10);
    expect(value).toBe('fast');
    await settle();
    expect(signal?.aborted).toBe(false);
  });

  it('leaves no unhandled rejection when the callee rejects before the deadline', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      await expect(withDeadline(() => Promise.reject(new Error('x')), 5)).rejects.toThrow('x');
      await settle();
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});

describe('raceDeadline', () => {
  it('reports the timeout when nothing else holds the event loop open', () => {
    // A child process, because that is the only place the claim is observable:
    // work that never settles holds no handle, so a deadline timer that does
    // not hold one either empties the loop and the process exits 13 before the
    // deadline it was asked for can fire. In-process, the test runner's own
    // handles mask it.
    const source =
      `import('@senars/util').then(async ({ raceDeadline }) => {` +
      `  const outcome = await raceDeadline(new Promise(() => {}), 100);` +
      `  process.stdout.write('timedOut=' + outcome.timedOut);` +
      `});`;
    const stdout = execFileSync(process.execPath, ['--import', 'tsx', '--eval', source], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(stdout).toBe('timedOut=true');
  });
});
