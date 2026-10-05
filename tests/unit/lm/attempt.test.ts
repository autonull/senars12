/**
 * `attempt` — the one place a call whose failure is expected is caught, logged
 * and answered.
 *
 * Falsifies the two rules the seven call sites now depend on: the message names
 * the operation, and the failure value is returned rather than thrown — while a
 * success still passes through untouched.
 */

import { attempt } from '@senars/nar/lm/service/errors.js';
import { describe, expect, it, vi } from 'vitest';

const logger = () => ({ warn: vi.fn() });

describe('attempt', () => {
  it('returns the resolved value and warns nothing', async () => {
    const log = logger();

    const result = await attempt(log, 'reading', async () => 42, 0);

    expect(result).toBe(42);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('awaits a promise-returning call', async () => {
    const result = await attempt(
      logger(),
      'reading',
      () => Promise.resolve('done'),
      'fallback'
    );

    expect(result).toBe('done');
  });

  it('answers the failure value and names the operation', async () => {
    const log = logger();

    const result = await attempt(
      log,
      'enriching concept: <x>',
      async () => {
        throw new Error('provider gone');
      },
      null
    );

    expect(result).toBeNull();
    expect(log.warn).toHaveBeenCalledWith('enriching concept: <x>: provider gone');
  });

  it('answers the failure value for a non-Error throw', async () => {
    const log = logger();

    const result = await attempt(
      log,
      'probing',
      async () => {
        throw 'a bare string';
      },
      -1
    );

    expect(result).toBe(-1);
    expect(log.warn).toHaveBeenCalledWith('probing: a bare string');
  });

  it('answers `null` when null is the declared failure value', async () => {
    const log = logger();

    const result = await attempt(
      log,
      'parsing',
      async () => {
        throw new Error('malformed');
      },
      null
    );

    expect(result).toBeNull();
    expect(log.warn).toHaveBeenCalledOnce();
  });
});