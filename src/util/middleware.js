/**
 * Unified middleware primitive (REFACTOR.todo4 Phase A).
 * The one onion dispatcher in the system: the agent's `MacroPhase` chain and
 * the transport's `MessageMiddleware` chain both run through it, so both get the
 * same double-`next()` guard instead of one of them having a permissive copy.
 */
import { SenarsError } from '../errors/senars-error';
/**
 * Onion-style dispatch for a middleware chain.
 * Throws if `next()` is called multiple times at the same index (guards against double-dispatch).
 */
export async function dispatch(chain, ctx) {
    let index = -1;
    const next = async (i) => {
        if (i <= index)
            throw new SenarsError('next() called multiple times', 'OPERATION_ERROR');
        index = i;
        await chain[i]?.(ctx, () => next(i + 1));
    };
    await next(0);
}
