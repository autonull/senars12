import { describe, expect, it } from 'vitest';
import { NAR } from '@senars/nar';
import { CognitiveRegistry, CognitiveController, resolveSlot } from '@senars/nar/cognitive';
import {
  type CognitiveParameters,
  DEFAULT_COGNITIVE_PARAMETERS,
} from '@senars/nar/config/cognitive-parameters';
import { Memory } from '@senars/nar/memory';
import { MetricsCollector } from '@senars/nar/metrics';
import { RuleProcessor } from '@senars/nar/rules';
import { NullAttentionModel } from '@senars/nar/strategies/attention/NullAttentionModel';
import { DEFAULT_CONFIG } from '@senars/nar/types';
import type { AttentionModel } from '@senars/nar/strategies/types';

/**
 * TODO27 — the `attention` slot is a slot.
 *
 * `attention` is one of the five registry slots, but it was the one resolved
 * outside `CognitiveController`: the NAR built the model in its constructor and
 * `reconfigure` / `setStrategy` never revisited it. The parameter graph then
 * reported whatever was configured while memory kept priming with the model
 * built at construction — a reconfigure that validated, stored, and did nothing.
 *
 * Asserted over behaviour, not over the source: the invariant is that the live
 * model follows the graph, and the pre-fix code passed every source-level check
 * while failing this one.
 */

const controller = (registry: CognitiveRegistry, memory: Memory) =>
  new CognitiveController(
    registry,
    memory,
    new RuleProcessor(),
    undefined,
    structuredClone(DEFAULT_COGNITIVE_PARAMETERS)
  );

/** One slot changed against the shipped graph, the way a caller spells it. */
const withAttention = (type: string): CognitiveParameters => ({
  ...DEFAULT_COGNITIVE_PARAMETERS,
  strategies: { ...DEFAULT_COGNITIVE_PARAMETERS.strategies, attention: { type } },
});

const registry = () => {
  const r = new CognitiveRegistry();
  r.initializeDefaults();
  return r;
};

const name = (model: AttentionModel): string => model.constructor.name;

describe('the attention slot resolves and re-resolves in one place', () => {
  it('a NAR installs the configured model rather than a constructor default', () => {
    const nar = new NAR({
      ...DEFAULT_CONFIG,
      cognitiveParams: withAttention('spreading'),
    });
    expect(name((nar as never as { memory: Memory }).memory.attentionModel)).toBe(
      'SpreadingActivation'
    );
  });

  it('reconfigure swaps the live model, not just the parameter graph', () => {
    const nar = new NAR();
    const memory = (nar as never as { memory: Memory }).memory;
    expect(name(memory.attentionModel)).toBe('SimpleAttention');

    nar.reconfigure(withAttention('goal-relevance'));

    expect(nar.getController()?.getStrategy('attention')).toBe('goal-relevance');
    expect(name(memory.attentionModel)).toBe('GoalRelevanceAttention');
  });

  it('setStrategy swaps the live model too', () => {
    const nar = new NAR();
    const memory = (nar as never as { memory: Memory }).memory;

    nar.getController()?.setStrategy('attention', 'spreading');

    expect(name(memory.attentionModel)).toBe('SpreadingActivation');
  });

  it('resolveSlot agrees with the controller — one slot, one resolution', () => {
    const r = registry();
    const params = withAttention('spreading');
    const memory = new Memory({ enableEmbeddingLayer: false });
    const c = controller(r, memory);

    c.reconfigure(params);

    // Reference-identical, not merely equal: the registry memoizes per slot, so
    // two callers asking for the same slot get the same instance.
    expect(memory.attentionModel).toBe(resolveSlot<AttentionModel>(r, params, 'attention'));
  });

  it('a memory given no model prunes nothing, so the slot owns the choice', () => {
    expect(new Memory().attentionModel).toBeInstanceOf(NullAttentionModel);
  });
});
