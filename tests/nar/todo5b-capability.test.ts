import { describe, expect, it } from 'vitest';
import { CapabilitySpace } from '@senars/nar/capability/space.js';
import { createDefaultHooks } from '@senars/nar/tick/bindings.js';
import { createPipeline, createTickContext, runTick } from '@senars/nar/tick/tick.js';
import { atom, createBudget, createTask } from '@senars/nar';

describe('TODO5b CapabilitySpace', () => {
  it('policy gate, approval gate, execution, diff grammar', async () => {
    const space = new CapabilitySpace({
      policy: { checkCommand: (cmd) => (cmd === 'evil' ? { allowed: false, reason: 'denylist' } : { allowed: true }) },
      approval: { requestApproval: async ({ action }) => (action === 'danger' ? { approved: false, feedback: 'human said no' } : { approved: true }) },
    });
    space.register({ name: 'safe', execute: ({ x }) => (x as number) * 2 });
    space.register({ name: 'danger', risk: 'high', execute: () => 'boom' });
    space.register({ name: 'evil', execute: () => 'never' });

    expect(await space.execute('safe', { x: 21 })).toEqual({ success: true, result: 42 });
    expect((await space.execute('evil')).success).toBe(false);
    expect(await space.execute('danger')).toEqual({ success: false, error: 'human said no' });
    expect((await space.execute('missing')).error).toMatch('not found');
    expect(space.validateDiff({ kind: 'tune-knob', payload: {} }).allowed).toBe(true);
    expect(space.validateDiff({ kind: 'drop-database', payload: {} }).allowed).toBe(false);
    expect(space.records()).toHaveLength(4);
  });

  it('drives tick act stage end-to-end', async () => {
    const space = new CapabilitySpace();
    space.register({ name: 'do_x', execute: () => 'done' });
    const ctx = createTickContext('cap1', { cycles: 10 });
    await runTick(ctx, createPipeline(createDefaultHooks({
      tools: space,
      proposers: [() => [createTask(atom('x'), 'goal', { f: 1, c: 0.9 }, createBudget(0.9))]],
      actionOf: () => ({ name: 'do_x', args: {} }),
      negotiator: { resolve: () => ({ action: 'do_x', actionExecuted: 'do_x', vetoedBy: null }) },
    })));
    expect(ctx.state.outcomes).toEqual([{ tool: 'do_x', success: true }]);
  });
});
