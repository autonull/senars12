import type { Task } from '../../types';
export { DEFAULT_DIVERGENCE_GAP, hasDivergence } from '@senars/util/divergence';
/**
 * How many subjects contradict themselves.
 *
 * The scan is per subject, not per pair: `hasDivergence` already answers the
 * subject question and stops at the first divergent pair, so the pair list this
 * replaced was built only to have its length read — one object per conflicting
 * pair, per cycle, thrown away. Buckets by term first, because beliefs about
 * different subjects are not comparable at all.
 */
export declare const countContradictions: (beliefs: readonly Task[], gap?: number) => number;
//# sourceMappingURL=conflict-utils.d.ts.map