/**
 * `degrade` — the one funnel for a call whose failure is expected: caught,
 * reported, and answered.
 *
 * Falsifies the rules every call site now depends on — the message names the
 * operation, the failure answer is returned rather than thrown, and a success
 * passes through untouched — plus the reason the answer is a function: a CLI
 * command's failure answer *is* the error text.
 */

import { degrade } from '@senars/util';
import { describe, expect, it, vi } from 'vitest';

const logger = () => ({ warn: vi.fn() });

describe('degrade', () => {
  it('returns the resolved value and warns nothing', async () => {
    const log = logger();

    const result = await degrade(
      log,
      'reading',
      async () => 42,
      () => 0
    );

    expect(result).toBe(42);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('awaits a promise-returning call', async () => {
    const result = await degrade(
      logger(),
      'reading',
      () => Promise.resolve('done'),
      () => 'fallback'
    );

    expect(result).toBe('done');
  });

  it('answers the failure value and names the operation', async () => {
    const log = logger();

    const result = await degrade(
      log,
      'enriching concept: <x>',
      async () => {
        throw new Error('provider gone');
      },
      () => null
    );

    expect(result).toBeNull();
    expect(log.warn).toHaveBeenCalledWith('enriching concept: <x>: provider gone');
  });

  it('answers the failure value for a non-Error throw', async () => {
    const log = logger();

    const result = await degrade(
      log,
      'probing',
      async () => {
        throw 'a bare string';
      },
      () => -1
    );

    expect(result).toBe(-1);
    expect(log.warn).toHaveBeenCalledWith('probing: a bare string');
  });

  it('hands the error to the failure answer, so the answer can be the message', async () => {
    const log = logger();

    const result = await degrade(
      log,
      'routing',
      async () => {
        throw new Error('no provider');
      },
      (error) => `routing failed: ${(error as Error).message}`
    );

    expect(result).toBe('routing failed: no provider');
  });

  it('answers `null` when null is the declared failure value', async () => {
    const log = logger();

    const result = await degrade(
      log,
      'parsing',
      async () => {
        throw new Error('malformed');
      },
      () => null
    );

    expect(result).toBeNull();
    expect(log.warn).toHaveBeenCalledOnce();
  });
});
