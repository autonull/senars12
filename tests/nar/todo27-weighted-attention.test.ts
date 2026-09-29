import { describe, expect, it } from 'vitest';
import { CognitiveRegistry } from '@senars/nar/cognitive';
import { ConfigurationError } from '@senars/nar/types';
import { CompositeAttention } from '@senars/nar/strategies/attention/CompositeAttention.js';
import { validateParameters } from '@senars/nar/config/cognitive-parameters';
import { Memory } from '@senars/nar/memory';
import { atom } from '../../nar/src/terms/index.js';
import type { AttentionModel } from '../../nar/src/strategies/types.js';

/**
 * TODO27 Bench 108 — a composite is a named strategy with configuration.
 *
 * Falsifies: "`composite` ignores its weights" and "a composite is a special
 * case the registry cannot express". `composite` resolves *other registrations
 * by name*, which is what `StrategyFactoryDeps` exists for, and the weights are
 * a ratio because the composite is a mean.
 */

const registry = () => {
  const r = new CognitiveRegistry();
  r.initializeDefaults();
  return r;
};

const primed = (model: AttentionModel, memory = new Memory({ enableEmbeddingLayer: false })) => {
  const concept = memory.addConcept(atom('cat'));
  return model.prime(concept, { concept, cycleCount: 0, memory });
};

const composite = (r: CognitiveRegistry, models: Array<{ name: string; weight: number }>) =>
  r.resolve<AttentionModel>('attention', 'composite', { models });

describe('Bench 108 — weighted attention is configuration', () => {
  it('the composite defaults to a single simple model', () => {
    const r = registry();
    expect(r.get<AttentionModel>('attention', 'composite')).toBeInstanceOf(CompositeAttention);
    expect(primed(r.get<AttentionModel>('attention', 'composite'))).toBe(0.3);
  });

  it('a weight is a ratio, not a gain', () => {
    const r = registry();
    // Both members prime at 0.3, so any non-zero weighting primes at 0.3.
    for (const models of [
      [{ name: 'simple', weight: 1 }, { name: 'spreading', weight: 1 }],
      [{ name: 'simple', weight: 3 }, { name: 'spreading', weight: 1 }],
      [{ name: 'simple', weight: 1 }, { name: 'spreading', weight: 99 }],
    ]) {
      expect(primed(composite(r, models))).toBe(0.3);
    }
  });

  it('a zero-weight member contributes nothing, not everything', () => {
    const r = registry();
    const weighted = composite(r, [{ name: 'simple', weight: 0 }, { name: 'spreading', weight: 1 }]);
    const plain = r.resolve<AttentionModel>('attention', 'spreading');
    expect(primed(weighted)).toBe(primed(plain));
  });

  it('the configured composite is a working attention model, not just a value', () => {
    const r = registry();
    const m = new Memory({ enableEmbeddingLayer: false });
    const concept = m.addConcept(atom('cat'));
    const model = composite(r, [{ name: 'simple', weight: 1 }]);
    expect(() => model.prime(concept, { concept, cycleCount: 0, memory: m })).not.toThrow();
    expect(() => model.decay(concept, 1, 0.01)).not.toThrow();
    expect(() => model.tick(m, 1)).not.toThrow();
  });

  it('a typo in a part name is a boundary error with the candidates', () => {
    const r = registry();
    const catalog = { list: (type: Parameters<typeof r.list>[0]) => r.list(type) };
    const errors = validateParameters(
      {
        strategies: { attention: { type: 'composite', config: { models: [{ name: 'spreding', weight: 1 }] } } } as never,
      },
      catalog
    ).errors;
    expect(errors[0]).toMatch(/models\[\]\.name/);
    expect(errors[0]).toMatch(/goal-relevance/);
    expect(() => composite(r, [{ name: 'spreding', weight: 1 }])).toThrow(ConfigurationError);
  });

  it('an all-zero weighting is rejected, because a mean of nothing is undefined', () => {
    const r = registry();
    expect(() => composite(r, [{ name: 'simple', weight: 0 }])).toThrow(ConfigurationError);
  });

  it('a composite may not name itself', () => {
    const r = registry();
    // Bypasses validation to reach the factory, where the recursion would be.
    expect(() =>
      r.resolve('attention', 'composite', { models: [{ name: 'composite', weight: 1 }] })
    ).toThrow(ConfigurationError);
  });

  it('two spellings of the same weighting are the same instance', () => {
    const r = registry();
    const a = composite(r, [{ name: 'simple', weight: 1 }, { name: 'spreading', weight: 3 }]);
    const b = composite(r, [{ name: 'spreading', weight: 3 }, { name: 'simple', weight: 1 }]);
    expect(b).toBe(a);
  });

  it('the list form and the named form agree when the weights are equal', () => {
    const r = registry();
    const asList = r.resolve<AttentionModel>('attention', ['simple', 'spreading']);
    expect(asList).toBeInstanceOf(CompositeAttention);
    expect(primed(asList)).toBe(0.3);
  });
});
