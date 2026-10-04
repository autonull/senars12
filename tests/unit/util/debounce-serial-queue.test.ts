import { debounce, SerialQueue } from '@senars/util';
import { describe, expect, it, vi } from 'vitest';

describe('debounce', () => {
  it('collapses a burst into one call carrying the last arguments', async () => {
    const spy = vi.fn<(a: number, b: number) => void>();
    const call = debounce(spy, 10);

    call(1, 1);
    call(2, 2);
    call(3, 3);
    expect(spy).not.toHaveBeenCalled();
    expect(call.pending).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(spy).toHaveBeenCalledExactlyOnceWith(3, 3);
    expect(call.pending).toBe(false);
  });

  it('restarts the window on each call, so a continuous stream never fires', async () => {
    const spy = vi.fn();
    const call = debounce(spy, 20);

    for (let i = 0; i < 5; i++) {
      call();
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(spy).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(spy).toHaveBeenCalledOnce();
  });

  it('cancel drops the pending call and is idempotent with nothing pending', async () => {
    const spy = vi.fn();
    const call = debounce(spy, 10);

    call();
    call.cancel();
    expect(call.pending).toBe(false);
    call.cancel();

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(spy).not.toHaveBeenCalled();
  });

  it('flush runs the pending call now with its last arguments', async () => {
    const spy = vi.fn<(n: number) => void>();
    const call = debounce(spy, 1000);

    call(7);
    call.flush();
    expect(spy).toHaveBeenCalledExactlyOnceWith(7);
    expect(call.pending).toBe(false);

    // The armed window must not survive the flush.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(spy).toHaveBeenCalledOnce();
  });

  it('flush with nothing pending does nothing', () => {
    const spy = vi.fn();
    debounce(spy, 10).flush();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('SerialQueue', () => {
  it('runs work one at a time, in submission order', async () => {
    const queue = new SerialQueue();
    const order: string[] = [];
    const task = (label: string, ms: number) => async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      order.push(label);
    };

    await Promise.all([queue.run(task('a', 20)), queue.run(task('b', 1)), queue.run(task('c', 1))]);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('never overlaps two in-flight tasks', async () => {
    const queue = new SerialQueue();
    let active = 0;
    let peak = 0;

    await Promise.all(
      Array.from({ length: 10 }, () =>
        queue.run(async () => {
          active++;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 1));
          active--;
        })
      )
    );
    expect(peak).toBe(1);
  });

  it('rejects only for the caller whose work failed, leaving the queue usable', async () => {
    const queue = new SerialQueue();

    const failed = queue.run(async () => {
      throw new Error('boom');
    });
    const after = queue.run(async () => 'still runs');

    await expect(failed).rejects.toThrow('boom');
    await expect(after).resolves.toBe('still runs');
    await expect(queue.idle()).resolves.toBeUndefined();
  });

  it('keeps draining after a failure in the middle of a burst', async () => {
    const queue = new SerialQueue();
    const done: number[] = [];

    const results = await Promise.allSettled([
      queue.run(async () => done.push(1)),
      queue.run(async () => {
        throw new Error('mid');
      }),
      queue.run(async () => done.push(3)),
    ]);

    expect(done).toEqual([1, 3]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('idle resolves before any work and after the queue drains', async () => {
    const queue = new SerialQueue();
    await expect(queue.idle()).resolves.toBeUndefined();

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = queue.run(async () => gate);

    let settled = false;
    void queue.idle().then(() => {
      settled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(settled).toBe(false);

    release();
    await pending;
    await queue.idle();
    expect(settled).toBe(true);
  });

  it('preserves each caller’s own result', async () => {
    const queue = new SerialQueue();
    const [a, b] = await Promise.all([queue.run(async () => 1), queue.run(async () => 'two')]);
    expect(a).toBe(1);
    expect(b).toBe('two');
  });
});
