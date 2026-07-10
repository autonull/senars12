import { Effect } from 'effect';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearOps } from '../src/core/ops.js';
import { MeTTaBuilder, MeTTaRuntime, createMeTTa } from '../src/index.js';
import { expr, num, sym } from '../src/index.js';
import { bootstrapStdLib } from '../src/index.js';

beforeEach(() => {
  clearOps();
  bootstrapStdLib();
});

describe('MeTTaBuilder', () => {
  it('creates runtime with default config', () => {
    const runtime = new MeTTaBuilder().build();
    expect(runtime).toBeInstanceOf(MeTTaRuntime);
  });

  it('creates runtime with custom config', () => {
    const runtime = new MeTTaBuilder().withConfig({ maxSteps: 5000 }).build();
    expect(runtime).toBeInstanceOf(MeTTaRuntime);
  });

  it('creates runtime with custom space', () => {
    const runtime = new MeTTaBuilder().withSpace('custom').build();
    expect(runtime).toBeInstanceOf(MeTTaRuntime);
  });

  it('createMeTTa function works', () => {
    const runtime = createMeTTa({ maxSteps: 100 });
    expect(runtime).toBeInstanceOf(MeTTaRuntime);
  });

  it('evaluates expressions', async () => {
    const runtime = createMeTTa();
    const program = expr(sym('+'), num(2), num(3));
    const result = await Effect.runPromise(runtime.evaluate(program));
    expect(result.kind).toBe(0);
    expect(result.value).toBe('5');
  });
});
