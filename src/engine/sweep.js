/**
 * The one engine fan-out.
 *
 * Six sites walked the engine map by hand: `Agent.start`/`stop` for the
 * lifecycle hooks, `MemoryService.persist`/`load`/`querySemantic` for the
 * persistence hooks, and the cycle's `reason`/`absorb` phases. Each spelled its
 * own `try`/`catch`, and the three variants disagreed about what a fault did —
 * two logged and tallied it, three swallowed it — so an engine that failed
 * `absorb` was invisible to `Agent.health().errorRate` while one that failed
 * `reason` was not.
 *
 * One sweep, with the fault policy as a parameter: omit `onError` for a lifecycle
 * sweep where one engine down is not a cycle fault, supply it where the caller has
 * a health tally to feed.
 */
import { errMsg } from '@senars/util/error';
/** Run one optional lifecycle hook, if the engine has it. */
export const invokeEngineHook = (engine, hook) => Promise.resolve(engine[hook]?.call(engine));
/**
 * Apply `work` to every engine in turn, collecting the answers and routing a
 * fault to `onError`. A work function returning `undefined` contributes nothing
 * to the result, so a hook-shaped sweep and a value-shaped one are both written
 * against this signature.
 */
export async function sweepEngines(engines, work, onError) {
    if (!engines)
        return [];
    const results = [];
    for (const [id, engine] of engines) {
        try {
            const value = await work(engine, id);
            if (value !== undefined)
                results.push(value);
        }
        catch (error) {
            onError?.(id, errMsg(error));
        }
    }
    return results;
}
