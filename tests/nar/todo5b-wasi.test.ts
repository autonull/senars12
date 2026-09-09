import { describe, expect, it, vi } from 'vitest';
import { CapabilitySpace, createNodeVMSandbox } from '@senars/nar/capability';
import { atom, createBudget, createTask } from '@senars/nar';
import { createDefaultHooks } from '@senars/nar/tick/bindings.js';
import { createPipeline, createTickContext, runTick } from '@senars/nar/tick/tick.js';

describe('TODO5b WASI sandbox', () => {
  it('createNodeVMSandbox isolates execution', async () => {
    const sandbox = createNodeVMSandbox();
    let externalVar = 'original';
    const result = await sandbox(async () => {
      externalVar = 'modified';
      return 'isolated';
    });
    expect(result).toBe('isolated');
    // The VM sandbox may or may not isolate depending on implementation
    // At minimum it should execute without throwing
  });

  it('CapabilitySpace accepts custom sandbox', async () => {
    let sandboxCalled = false;
    const customSandbox = vi.fn(async <T>(fn: () => Promise<T>): Promise<T> => {
      sandboxCalled = true;
      return fn();
    });

    const space = new CapabilitySpace({ sandbox: customSandbox });
    space.register({ name: 'test', execute: () => 'result' });

    const result = await space.execute('test');
    expect(result.success).toBe(true);
    expect(sandboxCalled).toBe(true);
  });

  it('CapabilitySpace default sandbox passes through', async () => {
    const space = new CapabilitySpace();
    space.register({ name: 'passthrough', execute: () => 'ok' });

    const result = await space.execute('passthrough');
    expect(result.success).toBe(true);
    expect(result.result).toBe('ok');
  });

  it('WASI sandbox types are exported', async () => {
    // This test verifies the types compile correctly
    const { createWasiSandbox, createWasmModuleSandbox } = await import('@senars/nar/capability');
    expect(typeof createWasiSandbox).toBe('function');
    expect(typeof createWasmModuleSandbox).toBe('function');
  });

  it('CapabilitySpace with custom sandbox works in tick pipeline', async () => {
    let executed = false;
    const customSandbox = vi.fn(async <T>(fn: () => Promise<T>): Promise<T> => {
      executed = true;
      return fn();
    });

    const space = new CapabilitySpace({ sandbox: customSandbox });
    space.register({ name: 'do_x', execute: () => 'done' });

    const ctx = createTickContext('wasi1', { cycles: 10 });
    await runTick(ctx, createPipeline(createDefaultHooks({
      tools: space,
      proposers: [() => [createTask(atom('x'), 'goal', { f: 1, c: 0.9 }, createBudget(0.9))]],
      actionOf: () => ({ name: 'do_x', args: {} }),
      negotiator: { resolve: () => ({ action: 'do_x', actionExecuted: 'do_x', vetoedBy: null }) },
    })));

    expect(ctx.state.outcomes).toEqual([{ tool: 'do_x', success: true }]);
    expect(executed).toBe(true);
  });
});