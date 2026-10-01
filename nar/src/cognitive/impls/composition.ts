/**
 * Slot composition (TODO27 §2.5): one spec form, five semantics.
 *
 * A `string[]` composes through the slot's own composite class; a
 * `StrategyExpression` is a derivation-only form and reuses the algebra
 * (Invariant D4: `sequence` is the only combinator meaningful for a
 * synchronous, total slot). Labels are deterministic, so composing the same
 * spec twice yields the same registered name.
 */

import { composeStrategy, type StrategyExpression, type StrategyResolver } from '../../reason/strategy-algebra';
import { CompositeAttention } from '../../strategies/attention/CompositeAttention.js';
import { CompositeLMRuleSelector } from '../../strategies/lm-selectors/CompositeLMRuleSelector.js';
import { CompositeSampling } from '../../strategies/sampling/CompositeSampling.js';
import { CompositeStrategy } from '../../strategies/premise/selection-strategies.js';
import type {
  AttentionModel,
  ModelRuleSelector,
  SamplingStrategy,
  Strategy,
  StrategyImpl,
  StrategyType,
} from '../../strategies/types.js';
import { describeSpec, isStrategyExpression, type CompositeSpec } from '../../strategies/registration.js';

const COMPOSED_PREFIX = 'composed:';

/** The stable registry name for a composed slot — `describeSpec` is the one renderer. */
export const composedName = (spec: CompositeSpec): string => `${COMPOSED_PREFIX}${describeSpec(spec)}`;

/**
 * One composite class per slot: the spec form is uniform, the semantics are not.
 * Each combiner narrows the union to its own slot's interface — the slot type is
 * the caller's premise, so this is the one place that assertion is written.
 */
const COMBINERS = {
  sampling: (parts: StrategyImpl[]) => new CompositeSampling(parts as SamplingStrategy[]),
  premise: (parts: StrategyImpl[]) => new CompositeStrategy(parts as Strategy[], 'dedup'),
  'lm-rule': (parts: StrategyImpl[]) => new CompositeLMRuleSelector(parts as ModelRuleSelector[]),
  attention: (parts: StrategyImpl[]) =>
    new CompositeAttention(
      (parts as AttentionModel[]).map((model) => ({ model, weight: 1 }))
    ),
} satisfies Record<string, (parts: StrategyImpl[]) => StrategyImpl>;

/**
 * Compose one spec into one instance. A single-element list is the part itself
 * — a "composite" of one is an indirection with no behaviour.
 */
export const composeSpec = <T>(
  type: StrategyType,
  spec: CompositeSpec,
  leaf: (name: string) => T
): T => {
  // The algebra already models composition; a list is its `sequence` form (D4/D7).
  if (isStrategyExpression(spec) || type === 'derivation') {
    const expression: StrategyExpression = isStrategyExpression(spec)
      ? spec
      : { op: 'sequence', stages: spec as string[] };
    return composeStrategy(expression, leaf as unknown as StrategyResolver) as unknown as T;
  }

  const parts = spec.map(leaf) as StrategyImpl[];
  if (parts.length === 1) return parts[0] as T;
  return COMBINERS[type as keyof typeof COMBINERS](parts) as T;
};
