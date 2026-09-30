import { describe, expect, it } from 'vitest';
import { CognitiveRegistry } from '@senars/nar/cognitive';
import { CognitiveController } from '@senars/nar/cognitive';
import {
  DEFAULT_COGNITIVE_PARAMETERS,
  mergeParameters,
  validateParameters,
} from '@senars/nar/config/cognitive-parameters';
import { Memory } from '@senars/nar/memory';
import { MetricsCollector } from '@senars/nar/metrics';
import { RuleProcessor } from '@senars/nar/rules';
import { ConfigurationError } from '@senars/nar/types';
import { RuleGraph } from '@senars/nar/strategies/lm-graph/RuleGraph.js';

/**
 * TODO27 Bench 102 — validation at the boundary.
 *
 * Falsifies: "a mistyped strategy name only surfaces from deep inside
 * `reconfigure`" and "an invalid config is silently ignored".
 */

const registry = () => {
  const r = new CognitiveRegistry();
  r.initializeDefaults();
  return r;
};

const controller = (r: CognitiveRegistry, params = DEFAULT_COGNITIVE_PARAMETERS) =>
  new CognitiveController(
    r,
    new Memory({ enableEmbeddingLayer: false }),
    new RuleProcessor(),
    new MetricsCollector(),
    undefined,
    structuredClone(params)
  );

describe('Bench 102 — boundary validation', () => {
  it('the shipped defaults validate (parity: this was a no-op before)', () => {
    expect(validateParameters(DEFAULT_COGNITIVE_PARAMETERS, registry())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('an unknown name names the slot and lists the candidates', () => {
    const result = validateParameters(
      { strategies: { ...DEFAULT_COGNITIVE_PARAMETERS.strategies, premise: { type: 'term-lnk' } } },
      registry()
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('strategies.premise.type');
    expect(result.errors[0]).toContain("'term-lnk'");
    expect(result.errors[0]).toContain('term-link');
  });

  it('an unknown name in a composed list names its position', () => {
    const result = validateParameters(
      {
        strategies: {
          ...DEFAULT_COGNITIVE_PARAMETERS.strategies,
          premise: { type: ['term-link', 'nope'] },
        },
      },
      registry()
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('strategies.premise[1]');
  });

  it('an empty list is rejected', () => {
    const result = validateParameters(
      { strategies: { ...DEFAULT_COGNITIVE_PARAMETERS.strategies, premise: { type: [] } } },
      registry()
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('at least one strategy name');
  });

  it('an unknown config key is rejected by the schema', () => {
    const result = validateParameters(
      {
        strategies: {
          ...DEFAULT_COGNITIVE_PARAMETERS.strategies,
          premise: { type: 'term-link', config: { minStrenght: 0.5 } },
        },
      },
      registry()
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('minStrenght');
  });

  it('an out-of-range config value is rejected with its bound', () => {
    const result = validateParameters(
      {
        strategies: {
          ...DEFAULT_COGNITIVE_PARAMETERS.strategies,
          premise: { type: 'term-link', config: { minStrength: 4 } },
        },
      },
      registry()
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('minStrength');
  });

  it('config on a stateful strategy is an error, not a shrug', () => {
    const r = registry();
    r.get<RuleGraph>('lm-rule', 'lm-graph');
    expect(() => r.resolve('lm-rule', 'lm-graph', { offset: 1 })).toThrow(ConfigurationError);
  });

  it('a config on a composed slot is rejected — configure its parts instead', () => {
    const r = registry();
    expect(() => r.resolve('premise', ['term-link', 'bag'], { minStrength: 0.5 })).toThrow(
      /composed premise slot takes no config/
    );
  });

  it('a strategy expression is a derivation-only form', () => {
    const r = registry();
    expect(() => r.resolve('premise', { op: 'sequence', stages: ['bag'] })).toThrow(
      /derivation-only/
    );
  });

  it('setStrategy rejects an unknown name before anything is rebuilt', () => {
    const c = controller(registry());
    expect(() => c.setStrategy('premise', 'nope')).toThrow(ConfigurationError);
    expect(c.getStrategy('premise')).toBe('default-formation');
  });

  it('a valid change round-trips through setStrategy → getStrategy', () => {
    const c = controller(registry());
    c.setStrategy('derivation', 'sampled', { fraction: 0.5, seed: 2 });
    expect(c.getStrategy('derivation')).toBe('sampled');
    c.setStrategy('premise', ['term-link', 'embedding-link']);
    expect(c.getStrategy('premise')).toEqual(['term-link', 'embedding-link']);
    c.setStrategy('derivation', 'default');
    expect(c.getStrategy('derivation')).toBe('default');
  });

  it('a controller built on an invalid parameter graph refuses to start', () => {
    const r = registry();
    const bad = mergeParameters({
      strategies: { ...DEFAULT_COGNITIVE_PARAMETERS.strategies, sampling: { type: 'prioritee' } },
    });
    expect(() => controller(r, bad)).toThrow(/prioritee/);
  });

  it('an injected config never writes through to the module default', () => {
    const c = controller(registry());
    c.setStrategy('premise', 'term-link', { minStrength: 0.42 });
    expect(DEFAULT_COGNITIVE_PARAMETERS.strategies.premise).toEqual({ type: 'default-formation' });
  });
});
