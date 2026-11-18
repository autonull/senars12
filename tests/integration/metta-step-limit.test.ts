import { createMeTTa, MeTTaReason, parseMeTTa } from '@senars/metta-runtime';
import { Cause, Effect, Exit } from 'effect';
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
    if (!Exit.isFailure(exit)) return;
    const error = exit.cause.reasons.find(Cause.isFailReason)?.error;
    expect(error?.reason).toBe(MeTTaReason.STEP_LIMIT);
    expect(error?.code).toBe('METTA_ERROR');
    expect(error?.context?.maxSteps).toBe(0);
  });

  it('honors a per-call override above the configured budget', () => {
    const exit = Effect.runSyncExit(
      createMeTTa({ maxSteps: 0 }).evaluate(parseMeTTa('! (+ 1 2)'), { maxSteps: 100 })
    );
    expect(exit._tag).toBe('Success');
  });
});
