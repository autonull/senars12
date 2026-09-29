import { describe, expect, it } from 'vitest';
import { CognitiveRegistry } from '@senars/nar/cognitive';
import { DEFAULT_COGNITIVE_PARAMETERS, validateParameters } from '@senars/nar/config/cognitive-parameters';
import { TermLinkStrategy } from '@senars/nar/strategies/premise/term-link.js';
import type { Strategy } from '../../nar/src/strategies/types.js';

/**
 * TODO27 Bench 100 — the dead composition surface is gone.
 *
 * Falsifies: "the registry still carries a second, `any`-cast way to compose
 * strategies" — the surface was the only `any` hole in the strategy system's
 * front door, and keeping it would keep two spellings of one concept alive.
 */

const registry = () => {
  const r = new CognitiveRegistry();
  r.initializeDefaults();
  return r;
};

describe('Bench 100 — one composition surface', () => {
  it('offers no compose, composePremise or createAdaptive', () => {
    const surface = registry() as unknown as Record<string, unknown>;
    for (const name of ['compose', 'composePremise', 'createAdaptive']) {
      expect(name in surface).toBe(false);
    }
  });

  it('exposes exactly one resolution path, of which get is the tier-0 case', () => {
    const r = registry();
    expect(r.resolve('premise', 'bag')).toBe(r.get('premise', 'bag'));
  });

  it('composes a premise list with no legacy entry point', () => {
    const composed = registry().resolve<Strategy>('premise', ['term-link', 'bag']);
    expect(typeof composed.selectSecondary).toBe('function');
  });

  it('declares every default as a name, a description and a config contract', () => {
    const r = registry();
    for (const type of ['sampling', 'premise', 'derivation', 'lm-rule', 'attention'] as const) {
      const registrations = r.list(type);
      expect(registrations.length).toBeGreaterThan(0);
      for (const registration of registrations) {
        expect(registration.name).toMatch(/^[a-z0-9-]+$/);
        expect(registration.description.length).toBeGreaterThan(0);
        expect(registration.stateful || registration.schema !== undefined).toBe(true);
      }
    }
  });

  it('validates the shipped defaults, with and without a catalog', () => {
    expect(validateParameters(DEFAULT_COGNITIVE_PARAMETERS).valid).toBe(true);
    expect(validateParameters(DEFAULT_COGNITIVE_PARAMETERS, registry()).valid).toBe(true);
  });

  it('a configured resolution cannot write through to the frozen defaults', () => {
    const r = registry();
    r.resolve('premise', 'term-link', { minStrength: 0.99 });
    expect(DEFAULT_COGNITIVE_PARAMETERS.strategies.premise.config).toBeUndefined();
    expect(r.get('premise', 'term-link')).toBeInstanceOf(TermLinkStrategy);
  });
});
