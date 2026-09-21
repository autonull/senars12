import type { ActionExecutionContext, CognitionAction } from './types.js';
import type { ParameterScope } from '../config/parameter-table.js';

/**
 * C3: seed actions. `cycle`/`revise`/`rest` are tier-0 reflex; manifold
 * ops tier-1; cortex ops (`clarify`, `spawn_subgoal`, `consolidate`,
 * `ask_lm`) tier-2. `tune` is domain-tagged: game-scoped callers can only
 * reach their own ParameterTable scope — system knobs are unreachable
 * outside the SelfMetaGame (enforcement via ParameterScopeError, C3 scope
 * bench).
 */
export const CYCLE: CognitionAction = { id: 'cycle', cost: 1, tier: 0, domain: 'game' };
export const REST: CognitionAction = { id: 'rest', cost: 0, tier: 0, domain: 'game' };
export const REVISE: CognitionAction = { id: 'revise', cost: 2, tier: 0, domain: 'game' };
export const CONSOLIDATE: CognitionAction = { id: 'consolidate', cost: 3, tier: 2, domain: 'game' };
export const SPAWN_SUBGOAL: CognitionAction = { id: 'spawn_subgoal', cost: 2, tier: 2, domain: 'game' };
export const CLARIFY: CognitionAction = { id: 'clarify', cost: 2, tier: 2, domain: 'game' };
export const ASK_LM: CognitionAction = { id: 'ask_lm', cost: 4, tier: 2, domain: 'game' };

export const tuneAction = (): CognitionAction => ({
  id: 'tune',
  cost: 1,
  tier: 0,
  domain: 'game',
  /** `tune(<param>, v)` — routed through the caller's ParameterTable scope. */
  execute(context: ActionExecutionContext) {
    const { parameterTable, scope, args } = context;
    const [name, value] = args ?? [];
    if (!parameterTable || !scope || name === undefined || value === undefined)
      throw new Error('tune requires parameterTable + scope');
    return parameterTable.set(scope as ParameterScope, name, value);
  },
});

/** Tier filtering: a tier-N context only offers actions with tier ≤ N. */
export const actionsForTier = (tier: number, actions: readonly CognitionAction[]): CognitionAction[] =>
  actions.filter((a) => a.tier <= tier);

export const DEFAULT_ACTIONS: readonly CognitionAction[] = [
  CYCLE, REST, REVISE, CONSOLIDATE, SPAWN_SUBGOAL, CLARIFY, ASK_LM, tuneAction(),
];
