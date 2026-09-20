import { FocusBag, FocusScheduler, GameFocus, createFocus } from '@senars/nar/focus';
import { SchedulerAdapter } from '@senars/nar/learning';
import type { FocusStepReport } from '@senars/nar/focus';
import type { GameFocus as GameFocusType } from '@senars/nar/focus';
import { createGridWorldGame } from '@senars/nar/game';
import { describe, expect, it } from 'vitest';

const report = (focusId: string, derivations: number, tasksProcessed: number): FocusStepReport => ({
  focusId,
  cycle: 1,
  budgetAllocated: 10,
  tasksProcessed,
  derivations,
  beliefsAdded: 0,
  goalsAdded: 0,
  questionsAdded: 0,
  gates: { perceptions: 0, actions: 0, rewards: 0 },
  timestamp: Date.now(),
});

/** Focus stub whose step returns a canned report (no kernel simulation needed). */
const stubFocus = (id: string, weight: number, step: () => Promise<unknown>): GameFocusType =>
  ({
    focus: createFocus({ id, weight }),
    step,
  }) as unknown as GameFocusType;

describe('TODO17 Bench 29 — FocusScheduler fairness', () => {
  it('honors weighted sampling within ±10% over 500 ticks', async () => {
    const bag = new FocusBag({ capacity: 8 });
    const a = stubFocus('heavy', 0.7, async () => ({ focusReport: report('heavy', 0, 1) }));
    const b = stubFocus('light', 0.3, async () => ({ focusReport: report('light', 0, 1) }));
    bag.add(a.focus);
    bag.add(b.focus);
    const scheduler = new FocusScheduler({ bag, seed: 42 });
    scheduler.register(a);
    scheduler.register(b);

    const results = await scheduler.run(500);
    const heavyShare = results.filter((r) => r.focusId === 'heavy').length / results.length;
    expect(heavyShare).toBeGreaterThan(0.63);
    expect(heavyShare).toBeLessThan(0.77);
  });

  it('a zero-weight focus receives 0 cycles', async () => {
    const bag = new FocusBag({ capacity: 8 });
    const live = stubFocus('live', 1, async () => ({ focusReport: report('live', 0, 1) }));
    const zero = stubFocus('zero', 0, async () => ({ focusReport: report('zero', 0, 1) }));
    bag.add(live.focus);
    bag.add(zero.focus);
    const scheduler = new FocusScheduler({ bag, seed: 7 });
    scheduler.register(live);
    scheduler.register(zero);

    const results = await scheduler.run(100);
    expect(results.every((r) => r.focusId !== 'zero')).toBe(true);
  });

  it('wall-clock deadline yields (AIKR) instead of starving', async () => {
    const bag = new FocusBag({ capacity: 8 });
    const stuck = stubFocus(
      'stuck',
      1,
      () => new Promise(() => undefined) // never resolves
    );
    bag.add(stuck.focus);
    const scheduler = new FocusScheduler({ bag, seed: 1, deadlineMs: 20 });
    scheduler.register(stuck);

    const results = await scheduler.run(2);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.yielded && r.report === null)).toBe(true);
  });

  it('step reports reach SchedulerAdapter and rebalance weights', async () => {
    const bag = new FocusBag({ capacity: 8 });
    const productive = stubFocus('productive', 0.5, async () => ({
      focusReport: report('productive', 10, 10),
    }));
    bag.add(productive.focus);
    const scheduler = new FocusScheduler({
      bag,
      seed: 1,
      schedulerAdapter: new SchedulerAdapter(bag),
    });
    scheduler.register(productive);
    const before = productive.focus.weight;

    await scheduler.run(10);

    expect(productive.focus.weight).toBeGreaterThan(before);
    expect(productive.focus.weight).toBeLessThanOrEqual(1);
  });

  it('registers and drives real GameFocuses end-to-end', async () => {
    const bag = new FocusBag({ capacity: 8 });
    const game = createGridWorldGame({ id: 'sched-grid', grid: ['S.', '.G'], seed: 3 });
    const focus = new GameFocus({ focusId: 'grid', game });
    bag.add(focus.focus);
    const scheduler = new FocusScheduler({ bag, seed: 5 });
    scheduler.register(focus);

    const results = await scheduler.run(5);
    expect(results.filter((r) => r.focusId === 'grid' && r.report)).toHaveLength(5);
    expect(focus.getCycle()).toBe(5);
  });
});
