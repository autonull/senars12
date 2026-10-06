import { createMeTTa, MeTTaReason, parseMeTTa } from '@senars/metta';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

const run = (maxSteps: number, program: string) =>
  Effect.runSyncExit(createMeTTa({ maxSteps }).evaluate(parseMeTTa(program)));

describe('MeTTa step limit', () => {
  it('reduces to normal form within the limit', () => {
    const exit = run(1000, '! (+ 1 2)');
    expect(exit._tag).toBe('Success');
  });

  it('fails with STEP_LIMIT when the configured budget is exhausted', () => {
    const exit = run(0, '! (+ 1 2)');
    expect(exit._tag).toBe('Failure');
    if (exit._tag !== 'Failure') return;
    const cause = exit.cause as {
      error?: { code?: string; reason?: string; context?: Record<string, unknown> };
    };
    expect(cause.error?.reason).toBe(MeTTaReason.STEP_LIMIT);
    expect(cause.error?.code).toBe('METTA_ERROR');
    expect(cause.error?.context?.maxSteps).toBe(0);
  });

  it('honors a per-call override above the configured budget', () => {
    const exit = Effect.runSyncExit(
      createMeTTa({ maxSteps: 0 }).evaluate(parseMeTTa('! (+ 1 2)'), { maxSteps: 100 })
    );
    expect(exit._tag).toBe('Success');
  });
});
