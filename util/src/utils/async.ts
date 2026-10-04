/**
 * Timing, deadlines, and cancellation. One clock and one deadline vocabulary, so
 * a duration measured by the LM service and a duration measured by a focus node
 * are the same kind of number.
 */

import { type Clock, systemClock } from './clock.js';

/** Raised by {@link withTimeout} unless a domain error is supplied. */
export class TimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Monotonic millisecond clock: sub-millisecond resolution, and immune to wall-clock
 * adjustment, so an NTP step can never shorten a measured span. `Date.now()` — the
 * {@link stopwatch} default — quantises to whole milliseconds, which is the right
 * trade for "how long did that LM call take" and the wrong one for a fast judgment
 * that legitimately takes a fraction of a millisecond.
 */
export const monotonicNow = (): number => performance.now();

/**
 * Elapsed milliseconds since the call — the one stopwatch, so every subsystem
 * (LM calls, tool executions, inference steps, trace spans) reports latency the
 * same way and a caller reads one clock, not a `start`/`Date.now() - start` pair.
 *
 * Measuring twice in one function is where this pays: a second `Date.now() - start`
 * is a *different* value for the same span, so a record and a trace emitted from one
 * operation disagree. Here the elapsed time is read once and reused.
 *
 * Pass {@link monotonicNow} where sub-millisecond resolution matters. The default is
 * the system clock, which fake timers drive.
 */
export const stopwatch = (now: Clock = systemClock): (() => number) => {
  const startedAt = now();
  return () => now() - startedAt;
};

/**
 * A deadline a caller can await, hand to the callee, and dispose of.
 *
 * `AbortSignal.timeout` covers the signal and nothing else: it cannot be
 * disposed, so using it leaves a timer armed until the process exits and a
 * deadline in the tree that no fake timer owns. This is the whole primitive —
 * one timer, one abort, one rejection, one idempotent dispose.
 */
export interface Deadline {
  /** Hand to the operation being bounded; aborts when the deadline elapses. */
  readonly signal: AbortSignal;
  /** Rejects with the timeout error when the deadline elapses. Never resolves. */
  readonly expired: Promise<never>;
  /** Idempotent. A deadline outlived is a live timer otherwise. */
  dispose(): void;
}

export const boundedDeadline = (
  timeoutMs: number,
  error: () => Error = () => new TimeoutError(timeoutMs)
): Deadline => {
  const controller = new AbortController();
  let expire!: (error: Error) => void;
  const expired = new Promise<never>((_, reject) => {
    expire = reject;
  });
  const timer = setTimeout(() => {
    const failure = error();
    controller.abort(failure);
    expire(failure);
  }, timeoutMs);
  timer.unref?.();
  return { signal: controller.signal, expired, dispose: () => clearTimeout(timer) };
};

/**
 * Await `work` under a deadline: the callee receives a signal that aborts when
 * the clock runs out, and the caller stops waiting at the same instant.
 *
 * `work` is handed the signal rather than it being threaded in, so a bounded
 * await and the cancellation it implies cannot come apart. The timer is disposed
 * on every exit path — resolve, reject, the deadline winning, or `work` throwing
 * before it returns a promise — which is the one obligation a caller spelling
 * this out by hand has to remember.
 *
 * The deadline rejects rather than resolving a sentinel, so a caller that wants
 * "unreachable is `null`" says so once with `catch`, not at every await.
 */
export function withDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  error?: () => Error
): Promise<T> {
  const { signal, expired, dispose } = boundedDeadline(timeoutMs, error);
  try {
    return Promise.race([work(signal), expired]).finally(dispose);
  } catch (failure) {
    dispose();
    throw failure;
  }
}

/**
 * Rejects with `error()` when `timeoutMs` elapses. The losing promise is not
 * cancelled — it keeps running; use only where orphaned work is safe.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  error: () => Error = () => new TimeoutError(timeoutMs)
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(error()), timeoutMs);
    timer.unref?.();
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/**
 * A timer that never holds the process open, handed back as an idempotent
 * disposer — the shared shape behind {@link periodic} and {@link deadline}, so
 * neither of them re-derives "unref it, and let `stop` be safe to call twice".
 */
const disarmed = (timer: ReturnType<typeof setTimeout>): (() => void) => {
  timer.unref?.();
  return () => clearTimeout(timer);
};

/**
 * Repeat `task` every `intervalMs` until the returned disposer is called.
 *
 * The timer is unref'd, so a periodic task never holds the process open — the one
 * property every hand-rolled `setInterval` site had to remember, and two of them
 * did not. The disposer is idempotent, so a `stop` that both `close` and an error
 * path call needs no guard, and assigning the result to a field replaces any
 * previous timer rather than leaking it.
 */
export const periodic = (task: () => void, intervalMs: number): (() => void) =>
  disarmed(setInterval(task, intervalMs));

/**
 * Run `onExpire` once after `timeoutMs`, unless the returned disposer runs first
 * — the "settle on the event or on the clock" shape.
 *
 * Every connect and startup path is this shape: a `setTimeout` that rejects *and*
 * tears down (dispose the client, close the server), plus a `clearTimeout` repeated
 * on each success branch. Spelled by hand that is where the two failure modes live
 * — a timer left armed after a fast success (it fires later and closes a socket
 * that is already closed) and a `clearTimeout` missing from one of the branches.
 * Here there is one call to make and one to undo, and the unref is inherited, so
 * the clock cannot delay exit.
 *
 * `dispose()` twice, or once the deadline has already fired, is a no-op.
 */
export const deadline = (timeoutMs: number, onExpire: () => void): (() => void) =>
  disarmed(setTimeout(onExpire, timeoutMs));

/**
 * Cooperative deadline: resolves `{ timedOut: true }` when `timeoutMs` elapses,
 * leaving `work` running. The interruptible-execution primitive — pair with
 * `AbortSignal` when the loser must stop.
 */
export function raceDeadline<T>(
  work: Promise<T>,
  timeoutMs: number
): Promise<{ value: T; timedOut: false } | { value?: undefined; timedOut: true }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const { promise: deadline, resolve: expire } =
    Promise.withResolvers<{ value?: undefined; timedOut: true }>();
  timer = setTimeout(() => expire({ timedOut: true }), timeoutMs);
  timer.unref?.();
  return Promise.race([
    work.then((value) => ({ value, timedOut: false as const })),
    deadline,
  ]).finally(() => clearTimeout(timer));
}

/**
 * A coalescing wrapper: rapid calls collapse into one invocation with the *last*
 * arguments, `ms` after the last of them.
 *
 * The four hand-rolled copies of this each owned their timer, so none of them
 * could cancel: a component unmounted mid-window left a live timer that fired
 * into a detached view, and a config panel held one timer handle per field with
 * no way to disarm them. `cancel` and `flush` are the two things the copies were
 * missing, and `pending` is what lets a caller assert the window is shut.
 *
 * `fn`'s return value is deliberately dropped — a debounced call has no caller
 * to return to. A caller that needs the work to happen at least once per window
 * wants a rate limiter ({@link SlidingWindowRateLimiter}) or a periodic, not a
 * wrapper that can skip it.
 */
export interface Debounced<Args extends unknown[] = []> {
  (...args: Args): void;
  /** Drop the pending invocation. Safe with nothing pending, and idempotent. */
  cancel(): void;
  /** Run the pending invocation now, if there is one. */
  flush(): void;
  readonly pending: boolean;
}

export const debounce = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number
): Debounced<Args> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest: Args;

  const disarm = (): void => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
  };

  const debounced = ((...args: Args): void => {
    latest = args;
    disarm();
    timer = setTimeout(() => {
      timer = undefined;
      fn(...latest);
    }, ms);
  }) as Debounced<Args>;

  debounced.cancel = disarm;
  debounced.flush = () => {
    if (timer === undefined) return;
    disarm();
    fn(...latest);
  };
  Object.defineProperty(debounced, 'pending', { get: () => timer !== undefined });
  return debounced;
};

/**
 * Run work one at a time, in submission order — the mutual exclusion primitive
 * for anything that cannot be re-entered.
 *
 * Two callers each spelled this as a bare promise chain, and the difference
 * between them was the bug: the llama-context chain swallowed rejections
 * (`tail = pending.catch(…)`) and the rule-producer chain did not, so a failing
 * flush would reject the chain *and* the promise a caller was awaiting, and
 * every subsequent enqueue would chain off a rejected promise. Here the tail is
 * reset in both arms by construction.
 *
 * Enqueue never rejects and never throws — the returned promise is `work`'s own,
 * so one caller's failure is that caller's failure and the queue keeps draining.
 */
export class SerialQueue {
  #tail: Promise<unknown> = Promise.resolve();

  /** Enqueue `work`. Resolves and rejects with it; later work is unaffected either way. */
  run<T>(work: () => Promise<T>): Promise<T> {
    const settled = this.#tail.then(work);
    this.#tail = settled.then(
      () => undefined,
      () => undefined
    );
    return settled;
  }

  /** Resolves when nothing is queued or in flight. */
  idle(): Promise<void> {
    return this.#tail.then(() => undefined);
  }
}
