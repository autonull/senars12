/**
 * Unified middleware primitive (REFACTOR.todo4 Phase A).
 * The one onion dispatcher in the system: the agent's `MacroPhase` chain and
 * the transport's `MessageMiddleware` chain both run through it, so both get the
 * same double-`next()` guard instead of one of them having a permissive copy.
 */

export type Middleware<C> = (ctx: C, next: () => Promise<void>) => Promise<void>;

/**
 * Onion-style dispatch for a middleware chain.
 * Throws if `next()` is called multiple times at the same index (guards against double-dispatch).
 */
export async function dispatch<C>(chain: readonly Middleware<C>[], ctx: C): Promise<void> {
  let index = -1;
  const next = async (i: number): Promise<void> => {
    if (i <= index) throw new Error('next() called multiple times');
    index = i;
    await chain[i]?.(ctx, () => next(i + 1));
  };
  await next(0);
}
