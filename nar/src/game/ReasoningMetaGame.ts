import { createParameterTable, type ParameterScope, type ParameterTable } from '../config/parameter-table.js';
import type { ReasoningGame } from './ReasoningGame.js';

/**
 * R3: the per-game MetaGame (TODO18 §1e) — reward-weight/difficulty tuning for
 * ONE ReasoningGame instance, through the game-scoped ParameterTable (F5).
 * Game-local tables are scopes of the same abstraction; system knobs are
 * unreachable from this scope (ParameterScopeError).
 */
export class ReasoningMetaGame {
  readonly id: string;
  private readonly table: ParameterTable;
  private readonly scope: ParameterScope;

  constructor(game: ReasoningGame, weights: Record<string, number>, table: ParameterTable = createParameterTable()) {
    this.id = `meta:${game.id}`;
    this.table = table;
    this.scope = `game:${game.id}`;
    for (const [rewardId, weight] of Object.entries(weights))
      this.table.register({
        name: `reward.${rewardId}`,
        scope: this.scope,
        min: 0,
        max: 1,
        value: weight,
        owner: this.id,
      });
  }

  setRewardWeight(rewardId: string, weight: number): number {
    return this.table.set(this.scope, `reward.${rewardId}`, weight);
  }

  /** P4 (TODO20): batched weight application — single validation pass, coalesced actuation. */
  setRewardWeights(weights: Record<string, number>): void {
    this.table.setMany(
      this.scope,
      Object.entries(weights).map(([id, weight]) => [`reward.${id}`, weight] as [string, number])
    );
  }

  getRewardWeight(rewardId: string): number | undefined {
    return this.table.get(this.scope, `reward.${rewardId}`);
  }

  getRewardWeights(): Record<string, number> {
    return Object.fromEntries([...this.table.list(this.scope)].map(([k, v]) => [k.replace('reward.', ''), v]));
  }

  /** Cross-scope tune attempts are rejected (scope enforcement, C3/R4.4). */
  tuneSystemKnob(name: string, value: number): never {
    return this.table.set('system', name, value) as never;
  }
}
