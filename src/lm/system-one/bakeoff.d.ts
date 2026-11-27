/**
 * L3 Bake-off: shared vs per-game heads.
 * Compares a shared head (with game features) against per-game heads on held-out Brier.
 */
import type { TrainingRow, HeadIdentity, SharedHeadBakeOffOptions, SharedHeadBakeOffResult } from './types';
/**
 * L3 (TODO19): train one shared `reflex_value` head across all registry games
 * (with a dense hashed `game` feature block) against one head per game, and
 * compare held-out Brier on identical per-game holdout splits. Deterministic.
 */
export declare function bakeOffSharedHead(rows: readonly TrainingRow[], meta: HeadIdentity, options?: SharedHeadBakeOffOptions): SharedHeadBakeOffResult;
//# sourceMappingURL=bakeoff.d.ts.map