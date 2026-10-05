import { describe, expect, it } from 'vitest';
import { CognitiveRegistry } from '@senars/nar/cognitive';
import { ConfigurationError } from '@senars/nar/types';
import type { Strategy } from '../../nar/src/strategies/types.js';

/**
 * TODO27 Bench 106 — the instance caches are bounded, not a leak.
 *
 * Falsifies: "a caller that mints a fresh config per cycle grows `configured`
 * without limit". Tier 1 and tier 2 keys come from user configuration, so they
 * are the two caches that need a bound; tier 0 is keyed by registration name and
 * is already bounded by the catalogue.
 */

const registry = () => {
  const r = new CognitiveRegistry();
  r.initializeDefaults();
  return r;
};

/** `minStrength` is the only free-form axis the premise `term-link` schema has. */
const DERIVATIONS = ['default', 'anytime', 'focused', 'sampled'] as const;

const configs = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ minStrength: i / (count * 2) }));

describe('Bench 106 — memoized instances are bounded', () => {
  it('a repeated digest is still the same instance', () => {
    const r = registry();
    const first = r.resolve<Strategy>('premise', 'term-link', { minStrength: 0.4 });
    expect(r.resolve<Strategy>('premise', 'term-link', { minStrength: 0.4 })).toBe(first);
  });

  it('distinct digests give distinct instances', () => {
    const r = registry();
    const a = r.resolve<Strategy>('premise', 'term-link', { minStrength: 0.1 });
    const b = r.resolve<Strategy>('premise', 'term-link', { minStrength: 0.9 });
    expect(a).not.toBe(b);
  });

  it('minting far more configs than the bound does not grow the cache past it', () => {
    const r = registry();
    for (const config of configs(500)) r.resolve('premise', 'term-link', config);
    expect(r.memoizedSize('premise')).toBeLessThanOrEqual(64);
  });

  it('a digest touched throughout the flood survives it', () => {
    const r = registry();
    const hot = r.resolve<Strategy>('premise', 'term-link', { minStrength: 0.999 });
    for (const config of configs(500)) {
      r.resolve('premise', 'term-link', config);
      r.resolve('premise', 'term-link', { minStrength: 0.999 });
    }
    expect(r.resolve<Strategy>('premise', 'term-link', { minStrength: 0.999 })).toBe(hot);
  });

  it('an untouched digest is the first to go, and comes back working', () => {
    const r = registry();
    const cold = r.resolve<Strategy>('premise', 'term-link', { minStrength: 0 });
    for (const config of configs(500)) r.resolve('premise', 'term-link', config);
    const again = r.resolve<Strategy>('premise', 'term-link', { minStrength: 0 });
    expect(again).not.toBe(cold);
    expect(again.name).toBe(cold.name);
    expect(typeof again.selectSecondary).toBe('function');
  });

  it('an unknown name in a composed slot is rejected before a label is minted', () => {
    const r = registry();
    r.resolve('premise', ['term-link', 'default-formation']);
    expect(() => r.resolve('premise', ['term-link', 'unknown-0'])).toThrow(ConfigurationError);
    expect(r.memoizedSize('premise')).toBe(1);
  });

  it('a composed label keeps stage order, so reordering is a different instance', () => {
    const r = registry();
    const forward = r.resolve('derivation', { op: 'sequence', stages: ['default', 'anytime'] });
    const reversed = r.resolve('derivation', { op: 'sequence', stages: ['anytime', 'default'] });
    expect(reversed).not.toBe(forward);
  });

  it('composed slots are bounded on the same terms', () => {
    const r = registry();
    // Base-4 encoding of the index over five stages gives 1024 distinct labels.
    for (let i = 0; i < 1024; i++) {
      const stages = [0, 2, 4, 6, 8].map((shift) => DERIVATIONS[(i >> shift) & 3]!);
      r.resolve('derivation', { op: 'sequence', stages });
    }
    expect(r.memoizedSize('derivation')).toBe(64);
  });

  it('re-registering a name drops the slot memo, since a digest embeds the name', () => {
    const r = registry();
    r.resolve('premise', 'term-link', { minStrength: 0.4 });
    expect(r.memoizedSize('premise')).toBe(1);
    r.unregister('premise', 'term-link');
    expect(r.memoizedSize('premise')).toBe(0);
  });

  it('tier 0 stays reference-identical no matter how much churn happens', () => {
    const r = registry();
    const before = r.get<Strategy>('premise', 'term-link');
    for (const config of configs(500)) r.resolve('premise', 'term-link', config);
    expect(r.get<Strategy>('premise', 'term-link')).toBe(before);
  });
});
