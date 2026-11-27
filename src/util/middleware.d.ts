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
export declare function dispatch<C>(chain: readonly Middleware<C>[], ctx: C): Promise<void>;
//# sourceMappingURL=middleware.d.ts.map