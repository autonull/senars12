import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {
  applyParamValues,
  COGNITIVE_PARAMETER_SPACE,
  GridSampler,
  RandomSampler,
  serializeParams,
  deserializeParams,
  CognitiveOptimizer,
} from '../../../src/nar/cognitive';
import {DEFAULT_COGNITIVE_PARAMETERS} from '../../../src/nar/config/cognitive-parameters';
import type {CognitiveParameters} from '../../../src/nar/config/cognitive-parameters';
import type {SearchSpace, MetricsSummary} from '../../../src/nar/cognitive/types';

describe('applyParamValues', () => {
  it('applies float values', () => {
    const result = applyParamValues(DEFAULT_COGNITIVE_PARAMETERS, {
      'priority.initial': 0.05,
    });
    expect(result.priority.initialPriority).toBe(0.05);
    // Original unchanged
    expect(DEFAULT_COGNITIVE_PARAMETERS.priority.initialPriority).not.toBe(0.05);
  });

  it('applies categorical strategy values', () => {
    const result = applyParamValues(DEFAULT_COGNITIVE_PARAMETERS, {
      'strategy.sampling': 'top-n',
      'strategy.premise': 'bag',
    });
    expect(result.strategies.sampling.type).toBe('top-n');
    expect(result.strategies.premise.type).toBe('bag');
  });

  it('applies int values for lm.maxRules', () => {
    const result = applyParamValues(DEFAULT_COGNITIVE_PARAMETERS, {
      'lm.maxRules': 7,
    });
    expect(result.strategies.lmRule.maxRules).toBe(7);
  });

  it('ignores unknown keys', () => {
    const result = applyParamValues(DEFAULT_COGNITIVE_PARAMETERS, {
      'nonexistent.key': 42,
    });
    expect(result).toEqual(DEFAULT_COGNITIVE_PARAMETERS);
  });

  it('does not mutate the original', () => {
    const original = structuredClone(DEFAULT_COGNITIVE_PARAMETERS);
    applyParamValues(DEFAULT_COGNITIVE_PARAMETERS, {'priority.initial': 0.99});
    expect(DEFAULT_COGNITIVE_PARAMETERS.priority.initialPriority).toBe(original.priority.initialPriority);
  });
});

describe('COGNITIVE_PARAMETER_SPACE', () => {
  it('contains all expected parameter keys', () => {
    const expectedKeys = [
      'priority.initial',
      'priority.directMentionBoost',
      'priority.decayRate',
      'strategy.sampling',
      'strategy.premise',
      'strategy.lmRule',
      'strategy.attention',
      'strategy.derivation',
      'lm.maxRules',
      'lm.timeout',
      'inference.maxDerivations',
      'inference.maxDepth',
    ];
    for (const key of expectedKeys) {
      expect(COGNITIVE_PARAMETER_SPACE.parameters[key]).toBeDefined();
    }
  });

  it('has correct types for each parameter', () => {
    expect(COGNITIVE_PARAMETER_SPACE.parameters['priority.initial']?.type).toBe('float');
    expect(COGNITIVE_PARAMETER_SPACE.parameters['strategy.sampling']?.type).toBe('categorical');
    expect(COGNITIVE_PARAMETER_SPACE.parameters['lm.maxRules']?.type).toBe('int');
    expect(COGNITIVE_PARAMETER_SPACE.parameters['priority.initial']?.log).toBe(true);
  });

  it('categorical strategy parameters have expected values', () => {
    const sampling = COGNITIVE_PARAMETER_SPACE.parameters['strategy.sampling'];
    expect(sampling?.values).toContain('priority');
    expect(sampling?.values).toContain('diverse');
  });
});

describe('GridSampler', () => {
  const smallSpace: SearchSpace = {
    parameters: {
      'priority.initial': { type: 'float', min: 0.1, max: 0.3 },
      'strategy.sampling': { type: 'categorical', values: ['priority', 'top-n'] },
      'lm.maxRules': { type: 'int', min: 1, max: 3 },
    }
  };

  it('enumerates all combinations exactly once then wraps', () => {
    const sampler = new GridSampler(smallSpace);
    const results: string[] = [];
    // Float: 3 values (0.1, 0.2, 0.3)
    // Categorical: 2 values (priority, top-n)
    // Int: 3 values (1, 2, 3)
    // Total: 3 * 2 * 3 = 18 combinations
    const totalCombos = 3 * 2 * 3; // 18
    for (let i = 0; i < totalCombos; i++) {
      const val = sampler.sample();
      results.push(JSON.stringify(val));
    }
    expect(new Set(results).size).toBe(totalCombos);

    // Next call should wrap around (reset)
    const next = sampler.sample();
    expect(next).toBeDefined();
  });

  it('sample returns values within expected ranges', () => {
    const sampler = new GridSampler(smallSpace);
    for (let i = 0; i < 10; i++) {
      const val = sampler.sample();
      expect(val['priority.initial']).toBeGreaterThanOrEqual(0.1);
      expect(val['priority.initial']).toBeLessThanOrEqual(0.3);
      expect(['priority', 'top-n']).toContain(val['strategy.sampling']);
      expect(val['lm.maxRules']).toBeGreaterThanOrEqual(1);
      expect(val['lm.maxRules']).toBeLessThanOrEqual(3);
    }
  });

  it('reset() restarts enumeration', () => {
    const sampler = new GridSampler(smallSpace);
    const first = sampler.sample();
    sampler.reset();
    const afterReset = sampler.sample();
    expect(afterReset).toEqual(first);
  });
});

describe('RandomSampler', () => {
  const testSpace: SearchSpace = {
    parameters: {
      'priority.initial': { type: 'float', min: 0.01, max: 0.3, log: true },
      'strategy.sampling': { type: 'categorical', values: ['priority', 'top-n', 'diverse'] },
      'lm.maxRules': { type: 'int', min: 1, max: 13 },
      'flag': { type: 'boolean' },
    }
  };

  it('produces values within expected ranges', () => {
    const sampler = new RandomSampler(testSpace);
    for (let i = 0; i < 50; i++) {
      const val = sampler.sample();
      expect(val['priority.initial']).toBeGreaterThanOrEqual(0.01);
      expect(val['priority.initial']).toBeLessThanOrEqual(0.3);
      expect(['priority', 'top-n', 'diverse']).toContain(val['strategy.sampling']);
      expect(val['lm.maxRules']).toBeGreaterThanOrEqual(1);
      expect(val['lm.maxRules']).toBeLessThanOrEqual(13);
      expect(typeof val['flag']).toBe('boolean');
    }
  });

  it('produces varied outputs', () => {
    const sampler = new RandomSampler(testSpace);
    const values = Array.from({length: 20}, () => sampler.sample()['strategy.sampling']);
    const unique = new Set(values);
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe('serialization round-trip', () => {
  it('serializeParams and deserializeParams round-trip', () => {
    const json = serializeParams(DEFAULT_COGNITIVE_PARAMETERS);
    const restored = deserializeParams(json);
    expect(restored).toEqual(DEFAULT_COGNITIVE_PARAMETERS);
  });

  it('handles partial deserialization', () => {
    const json = JSON.stringify({
      priority: { initialPriority: 0.25 },
    });
    const restored = deserializeParams(json);
    // mergeParameters fills in defaults for missing fields
    expect(restored.priority.initialPriority).toBe(0.25);
  });
});
