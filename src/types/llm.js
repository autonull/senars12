import { createCallTally, recordCall } from '@senars/util/tally';
/**
 * The LM tiers, and the one list they are enumerated from — every column of the
 * model matrix, every key of the routing table, and every tier the CLI, the
 * doctor and the MCP resource report.
 *
 * `compact` was the fourth tier the model factory had been building and the
 * routing table could not name. `LMTask` said three, `model-factory.ts`
 * registered `cloud:compact` / `llamacpp:compact` / `llamacpp-embedded:compact`
 * / `webllm:compact` / `builtin:compact` anyway, and `CHAINS` — typed
 * `Record<LMTask, …>`, so it was *required* to be exhaustive — therefore had no
 * rung for it. Asking for a compact model threw out of `getModelChain`, was
 * swallowed by `LMService.getModel`'s bare `catch`, and reached the operator as
 * "no model for that tier" while `senars.config.json` sat there configuring
 * `compactModel`. The sites that had noticed the fourth tier each invented a way
 * to say it: `LMTask | 'compact'` in three signatures in `embedded-llamacpp.ts`,
 * and an `as never` in the MCP resource that silenced the type error the cast was
 * standing on top of.
 *
 * One list, one derived type, and `Record<LMTask, …>` goes back to meaning
 * "one rung per tier the factory builds".
 */
export const LM_TASKS = ['quality', 'fast', 'structured', 'compact'];
export const createLMStats = () => ({ ...createCallTally(), totalTokens: 0 });
/** Fold one LM attempt into `stats` — the `recordCall` counters plus the tokens it spent. */
export const recordLMCall = (stats, success, durationMs, tokens = 0) => {
    recordCall(stats, success, durationMs);
    stats.totalTokens += tokens;
};
/**
 * The three states a provider circuit can be in, and the one list they are
 * enumerated from. It lived in nar's circuit breaker while `ModelRuleStats`
 * below and the prometheus gauge each re-spelled it; a leaf union is what makes
 * one breaker reportable from every layer.
 */
export const CIRCUIT_STATES = ['closed', 'open', 'half-open'];
