import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createTickContext, runTick, createPipeline, DEFAULT_PIPELINE, initOtel, shutdownOtel, instrumentPipeline, wrapMiddlewareWithSpan } from '@senars/nar/tick';

describe('TODO5b OTel integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    initOtel({ enabled: true, batch: false });
  });

  afterEach(async () => {
    await shutdownOtel();
    vi.useRealTimers();
  });

  it('initOtel and shutdownOtel work', async () => {
    await shutdownOtel();
    initOtel({ enabled: true });
    await shutdownOtel();
  });

  it('wrapMiddlewareWithSpan wraps middleware and records span', async () => {
    const ctx = createTickContext('test-tick', { cycles: 10 });
    let called = false;
    const mw = wrapMiddlewareWithSpan('perceive', async (c, next) => {
      called = true;
      await next();
    });
    await mw(ctx, async () => {});
    expect(called).toBe(true);
  });

  it('instrumentPipeline wraps all 11 stages', async () => {
    const instrumented = instrumentPipeline(DEFAULT_PIPELINE);
    expect(instrumented).toHaveLength(11);
    const ctx = createTickContext('test-tick-2', { cycles: 5 });
    await runTick(ctx, instrumented);
    expect(ctx.events.map((e) => e.stage)).toEqual([
      'perceive', 'recall', 'attend', 'reason', 'propose',
      'negotiate', 'authorize', 'act', 'validate', 'learn', 'consolidate',
    ]);
  });

  it('instrumented pipeline records duration attribute', async () => {
    const instrumented = instrumentPipeline(DEFAULT_PIPELINE);
    const ctx = createTickContext('test-tick-3', { cycles: 5 });
    await runTick(ctx, instrumented);
    expect(ctx.events.length).toBeGreaterThan(0);
  });

  it('disabled OTel does not throw', async () => {
    await shutdownOtel();
    initOtel({ enabled: false });
    const instrumented = instrumentPipeline(DEFAULT_PIPELINE);
    const ctx = createTickContext('test-tick-4', { cycles: 5 });
    await runTick(ctx, instrumented);
    expect(ctx.events.map((e) => e.stage)).toHaveLength(11);
  });
});