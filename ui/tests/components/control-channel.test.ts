import { afterEach, describe, expect, it, vi } from 'vitest';
import { awaitControl, settleControl } from '../../src/client/core/control-channel.js';

describe('control channel', () => {
  afterEach(() => vi.useRealTimers());

  it('settles the request the response echoes, even out of order', async () => {
    const first = awaitControl();
    const second = awaitControl();

    // A run/abort race replies to the later request first.
    settleControl(second.seqId, { ok: true, message: 'aborted' });
    settleControl(first.seqId, { ok: false, message: 'cancelled' });

    await expect(second.result).resolves.toMatchObject({ ok: true, message: 'aborted' });
    await expect(first.result).resolves.toMatchObject({ ok: false, message: 'cancelled' });
  });

  it('ignores a response whose seqId matches no request', async () => {
    vi.useFakeTimers();
    const { seqId, result } = awaitControl();
    settleControl(seqId + 1, { ok: true });
    await expect(Promise.race([result, Promise.resolve('pending')])).resolves.toBe('pending');
  });

  it('settles ok:false when the engine never answers', async () => {
    vi.useFakeTimers();
    const { result } = awaitControl();
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(result).resolves.toMatchObject({ ok: false });
  });

  it('carries an ask answer through to the caller', async () => {
    const { seqId, result } = awaitControl();
    settleControl(seqId, {
      ok: true,
      answer: { answer: '(robin-->animal)', frequency: 1, confidence: 0.9, hasDerivation: true },
    });
    await expect(result).resolves.toMatchObject({
      ok: true,
      answer: { answer: '(robin-->animal)', hasDerivation: true },
    });
  });
});
