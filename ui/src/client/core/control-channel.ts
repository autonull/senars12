/**
 * The reasoning control channel: correlates a control request with the engine's
 * `reasoning.control.response` so `makeControl` can await the real outcome instead
 * of returning an optimistic `{ ok: true }`.
 *
 * Correlation is by `seqId`, not arrival order. A `run`/`abort` race replies to the
 * abort first and the aborted run second, so an order-based queue would settle the
 * wrong promise; the engine echoes the request's `seqId` and the map settles exactly
 * one. A request that is never answered settles `ok:false` on timeout — a control
 * that hangs would be a dead end.
 */
import type { ControlResult } from './reasoning-backend.js';

const CONTROL_TIMEOUT_MS = 15_000;

type Pending = {
  resolve: (result: ControlResult) => void;
  timeout: ReturnType<typeof setTimeout>;
};

let nextSeqId = 1;
const pending = new Map<number, Pending>();

/** Reserve a `seqId` and the promise its response will settle. */
export function awaitControl(): { seqId: number; result: Promise<ControlResult> } {
  const seqId = nextSeqId++;
  const result = new Promise<ControlResult>((resolve) => {
    const timeout = setTimeout(() => {
      pending.delete(seqId);
      resolve({ ok: false, message: 'No response from engine' });
    }, CONTROL_TIMEOUT_MS);
    pending.set(seqId, { resolve, timeout });
  });
  return { seqId, result };
}

/** Settle the request the engine just answered; unknown or uncorrelated ids are ignored. */
export function settleControl(seqId: number | undefined, result: ControlResult): void {
  if (seqId === undefined) return;
  const entry = pending.get(seqId);
  if (!entry) return;
  pending.delete(seqId);
  clearTimeout(entry.timeout);
  entry.resolve(result);
}
