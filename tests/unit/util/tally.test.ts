import {
  type CallTally,
  CallTallySeries,
  createCallTally,
  DisposalRegistry,
  recordCall,
} from '../../../util/src';

describe('recordCall', () => {
  it('derives rate and mean duration from the counters it keeps', () => {
    const tally = createCallTally();

    recordCall(tally, true, 10, 100);
    recordCall(tally, false, 30, 200);

    expect(tally).toMatchObject({
      totalCalls: 2,
      successfulCalls: 1,
      failedCalls: 1,
      totalDuration: 40,
      averageDuration: 20,
      successRate: 0.5,
      lastCalled: 200,
    });
  });

  it('mints at zero so the first read is defined, not NaN', () => {
    const tally: CallTally = createCallTally();

    expect(tally.successRate).toBe(0);
    expect(tally.averageDuration).toBe(0);
  });
});

describe('CallTallySeries', () => {
  const series = () =>
    new CallTallySeries<string, { name: string } & CallTally>({
      maxSize: 2,
      create: (name) => ({ ...createCallTally(), name }),
    });

  it('keeps one tally per key and accumulates across calls', () => {
    const tallies = series();

    tallies.record('a', true, 5);
    const second = tallies.record('a', false, 15);

    expect(tallies.size()).toBe(1);
    expect(second).toMatchObject({ totalCalls: 2, successfulCalls: 1, failedCalls: 1 });
    expect(tallies.get('a')).toBe(second);
  });

  it('carries the caller’s own fields through create', () => {
    const tallies = series();

    expect(tallies.record('tool', true, 1).name).toBe('tool');
  });

  it('holds capacity against a stream of one-shot keys', () => {
    const tallies = series();

    for (const key of ['a', 'b', 'c', 'd']) tallies.record(key, true, 1);

    expect(tallies.size()).toBe(2);
    expect([...tallies.keys()]).toEqual(['c', 'd']);
    expect(tallies.pressure()).toBe(1);
  });

  it('reports unmeasured pressure as 0 until it is full', () => {
    const tallies = series();

    tallies.record('a', true, 1);

    expect(tallies.pressure()).toBe(0.5);
  });

  it('forgets one key or all of them', () => {
    const tallies = series();
    tallies.record('a', true, 1);
    tallies.record('b', true, 1);

    tallies.reset('a');
    expect([...tallies.keys()]).toEqual(['b']);

    tallies.reset();
    expect(tallies.size()).toBe(0);
  });

  it('stamps from an injected clock', () => {
    const tallies = new CallTallySeries<string, CallTally>({
      maxSize: 4,
      create: createCallTally,
      now: () => 42,
    });

    expect(tallies.record('a', true, 1).lastCalled).toBe(42);
  });
});

describe('DisposalRegistry', () => {
  it('runs every teardown once, in reverse registration order', async () => {
    const order: string[] = [];
    const registry = new DisposalRegistry();
    registry.add(() => {
      order.push('first');
    });
    registry.add(() => {
      order.push('second');
    });

    await registry.disposeAll();
    await registry.disposeAll();

    expect(order).toEqual(['second', 'first']);
    expect(registry.size).toBe(0);
    expect(registry.disposed).toBe(true);
  });

  it('runs a registration that arrives after disposal at once', async () => {
    const order: string[] = [];
    const registry = new DisposalRegistry();
    await registry.disposeAll();

    registry.add(() => {
      order.push('late');
    });

    expect(order).toEqual(['late']);
  });

  it('ignores an absent unsubscribe', async () => {
    const order: string[] = [];
    const registry = new DisposalRegistry();
    registry.track(undefined);
    registry.track(() => {
      order.push('present');
    });
    registry.track(null);

    await registry.disposeAll();

    expect(order).toEqual(['present']);
  });

  it('finishes synchronous teardown before it returns', () => {
    const order: string[] = [];
    const registry = new DisposalRegistry();
    registry.add(() => {
      order.push('sync');
    });

    void registry.disposeAll();

    expect(order).toEqual(['sync']);
  });

  it('awaits an async teardown', async () => {
    const order: string[] = [];
    const registry = new DisposalRegistry();
    registry.add(async () => {
      await Promise.resolve();
      order.push('async');
    });

    await registry.disposeAll();

    expect(order).toEqual(['async']);
  });

  it('runs the teardowns behind a synchronous failure and rethrows it at once', () => {
    const order: string[] = [];
    const registry = new DisposalRegistry();
    registry.add(() => {
      order.push('kept');
    });
    registry.add(() => {
      throw new Error('first failure');
    });

    expect(() => registry.disposeAll()).toThrow('first failure');
    expect(order).toEqual(['kept']);
  });

  it('rejects on an async failure without stranding the ones behind it', async () => {
    const order: string[] = [];
    const registry = new DisposalRegistry();
    registry.add(() => {
      order.push('kept');
    });
    registry.add(async () => {
      await Promise.resolve();
      throw new Error('async failure');
    });

    await expect(registry.disposeAll()).rejects.toThrow('async failure');
    expect(order).toEqual(['kept']);
  });
});
