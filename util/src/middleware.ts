/**
 * Unified middleware primitive (REFACTOR.todo4 Phase A).
 * Replaces duplicate dispatch loops in `core/src/agent/pipeline.ts` and `nar/src/tick/tick.ts`.
 * Both `TickMiddleware` and `MacroPhase` share the same type signature and dispatch logic.
 */

export type Middleware<C> = (ctx: C, next: () => Promise<void>) => Promise<void>;

/**
 * Onion-style dispatch for a middleware chain.
 * Throws if `next()` is called multiple times at the same index (guards against double-dispatch).
 */
export async function dispatch<C>(
  chain: readonly Middleware<C>[],
  ctx: C
): Promise<void> {
  let index = -1;
  const next = async (i: number): Promise<void> => {
    if (i <= index) throw new Error('next() called multiple times');
    index = i;
    await chain[i]?.(ctx, () => next(i + 1));
  };
  await next(0);
}

/**
 * Creates a passthrough middleware that emits an event and calls next.
 * Useful for simple logging/telemetry stages.
 */
export const passthrough =
  <C>(stage: string, emit: (ctx: C, stage: string) => void): Middleware<C> =>
  async (ctx, next) => {
    emit(ctx, stage);
    await next();
  };