import { describe, expect, it } from 'vitest';
import { CognitiveRegistry } from '@senars/nar/cognitive';
import { Memory } from '@senars/nar/memory';
import { atom, Truth } from '../../nar/src/terms/index.js';
import { createBeliefTask, createBudget } from '../../nar/src/types/index.js';
import { ConfigurationError } from '@senars/nar/types';
import type {
  AttentionModel,
  DerivationStrategy,
  LMRuleSelector,
  SamplingStrategy,
  Strategy,
} from '../../nar/src/strategies/types.js';
import type { LMRule } from '../../nar/src/lm/LMRule.js';
import { CompositeStrategy } from '@senars/nar/strategies/premise/selection-strategies.js';
import { CompositeSampling } from '@senars/nar/strategies/sampling/CompositeSampling.js';
import { CompositeAttention } from '@senars/nar/strategies/attention/CompositeAttention.js';
import { CompositeLMRuleSelector } from '@senars/nar/strategies/lm-selectors/CompositeLMRuleSelector.js';

/**
 * TODO27 Bench 103 — one spec form for every slot.
 *
 * Falsifies: "composition is premise-only" and "a premise list and a premise
 * `sequence` are two spellings of one thing" (D7).
 */

const registry = () => {
  const r = new CognitiveRegistry();
  r.initializeDefaults();
  return r;
};

const memory = () => {
  const m = new Memory({ enableEmbeddingLayer: false });
  for (const term of [atom('cat'), atom('animal'), atom('whiskers')]) {
    m.addConcept(term).addTask('belief', { term, truth: Truth.create(0.9, 0.9), budget: createBudget(0.9) });
  }
  m.getLinkManager().addLink(atom('cat'), atom('animal'), { priority: 0.8 });
  return m;
};

const rules = (): LMRule[] =>
  (['a', 'b', 'c'] as const).map(
    (name) => ({ id: name, name, category: 'general', priority: 0.5 }) as LMRule
  );

describe('Bench 103 — uniform composition', () => {
  it('sampling composes to a working union', () => {
    const composed = registry().resolve<SamplingStrategy>('sampling', ['priority', 'top-n']);
    expect(composed).toBeInstanceOf(CompositeSampling);
    const sampled = composed.sample(memory(), 2);
    expect(new Set(sampled.map((c) => c.term.toString())).size).toBe(2);
  });

  it('premise composes to a deduped union', () => {
    const composed = registry().resolve<Strategy>('premise', ['term-link', 'bag']);
    expect(composed).toBeInstanceOf(CompositeStrategy);
    const premises = composed.selectSecondary(
      createBeliefTask(atom('cat'), Truth.create(0.9, 0.9), 0.9),
      memory()
    );
    expect(new Set(premises.map((p) => p.term.toString())).size).toBe(premises.length);
  });

  it('derivation composes to a working sequence', async () => {
    const r = registry();
    const composed = r.resolve<DerivationStrategy>('derivation', ['default', 'anytime']);
    const pairs: string[] = [];
    const engine = {
      processSync: (p1: { term: { toString(): string } }, p2: { term: { toString(): string } }) => {
        pairs.push(`${p1.term.toString()}|${p2.term.toString()}`);
        return [];
      },
      processLMRules: async function* () {
        /* no LM here */
      },
    };
    for await (const _ of composed.derive(
      createBeliefTask(atom('p'), Truth.create(0.9, 0.9), 0.9),
      [createBeliefTask(atom('a'), Truth.create(0.9, 0.9), 0.9)],
      engine,
      { maxDerivations: 10, maxDepth: 3, cpuThrottleMs: 0, singlePremiseEnabled: false }
    ))
      void _;
    expect(pairs.length).toBe(2);
  });

  it('lm-rule composes to a union capped by maxRules', () => {
    const composed = registry().resolve<LMRuleSelector>('lm-rule', ['priority', 'diverse']);
    expect(composed).toBeInstanceOf(CompositeLMRuleSelector);
    const selected = composed.select(rules(), {
      maxRules: 2,
      conceptPriority: 0.5,
      premiseCount: 2,
    });
    expect(selected.map((rule) => rule.name).sort()).toEqual(['a', 'b']);
  });

  it('attention composes to a weighted blend', () => {
    const r = registry();
    const composed = r.resolve<AttentionModel>('attention', ['simple', 'goal-relevance']);
    expect(composed).toBeInstanceOf(CompositeAttention);
    const m = memory();
    const concept = m.getConcept(atom('cat'))!;
    const ctx = { concept, cycleCount: 0, memory: m };
    expect(r.resolve<AttentionModel>('attention', 'simple').prime(concept, ctx)).toBe(0.3);
    expect(composed.prime(concept, ctx)).toBe(0.6);
  });

  it('a single-element list is the strategy itself, not a wrapper', () => {
    const r = registry();
    expect(r.resolve<Strategy>('premise', ['bag'])).toBe(r.get('premise', 'bag'));
  });

  it('composition is memoized by its label, so re-resolving is the same object', () => {
    const r = registry();
    const first = r.resolve<Strategy>('premise', ['term-link', 'bag']);
    expect(r.resolve<Strategy>('premise', ['term-link', 'bag'])).toBe(first);
    // Order is the label: a different order is a different composition.
    expect(r.resolve<Strategy>('premise', ['bag', 'term-link'])).not.toBe(first);
  });

  it('a list is the only premise spelling — an expression is rejected', () => {
    const r = registry();
    expect(() => r.resolve('premise', { op: 'sequence', stages: ['term-link', 'bag'] })).toThrow(
      ConfigurationError
    );
  });

  it('a list with an unknown name fails at validation, not at the first recall', () => {
    const r = registry();
    expect(() => r.resolve('premise', ['term-link', 'nope'])).toThrow(/premise\[1\]/);
  });
});
