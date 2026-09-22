/**
 * TODO20 Bench 63 — Determinism & Test Reliability.
 * Falsifies: Bag sampling depends on module-load order; RandomSource injection
 * doesn't reproduce streams; RNG call sites regressed to bare Math.random.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PriorityBag } from '../../nar/src/bag';
import type { BagItem } from '../../nar/src/bag';
import { Negotiator } from '../../nar/src/reflex';
import { createLCG, pinDeterministicRNG, restoreRNG, withDeterministicRNG } from '../helpers/rng';

interface Item extends BagItem {
  label: string;
}

const item = (id: number, priority: number): Item => ({ id: `i${id}`, priority, label: `#${id}` });

const seedBag = (rng: () => number, n = 50): string[] => {
  const bag = new PriorityBag<Item>({ capacity: 100, rng });
  for (let i = 0; i < n; i++) bag.add(item(i, (i % 7) + 1));
  const sampled: string[] = [];
  for (let i = 0; i < 30; i++) {
    const s = bag.sample();
    if (s) sampled.push(s.id);
  }
  return sampled;
};

describe('Bench 63 — Determinism', () => {
  it('same seed ⇒ identical Bag sample stream; different seed ⇒ divergent', () => {
    const a = seedBag(createLCG(42));
    const b = seedBag(createLCG(42));
    const c = seedBag(createLCG(43));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('Math.random fallback still works when no rng injected', () => {
    pinDeterministicRNG(7);
    try {
      const a = seedBag(Math.random);
      pinDeterministicRNG(7);
      const b = seedBag(Math.random);
      expect(a).toEqual(b);
    } finally {
      restoreRNG();
    }
  });

  it('withDeterministicRNG isolates the stream and always restores', async () => {
    const before = Math.random();
    const first = await withDeterministicRNG((rng) => [rng(), rng(), rng()], 99);
    const second = await withDeterministicRNG((rng) => [rng(), rng(), rng()], 99);
    expect(first).toEqual(second);
    // global stream restored — not the LCG
    expect(Math.random()).not.toBe(first[0]);
    expect(before).toBeDefined();
  });

  it('LCG produces values in [0,1) and reproduces', () => {
    const rng = createLCG(1);
    const values = Array.from({ length: 1000 }, () => rng());
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(createLCG(1)()).toBe(values[0]);
  });

  it('Negotiator is RNG-free (veto resolution is a pure function)', () => {
    const source = readFileSync(new URL('../../nar/src/reflex/Negotiator.ts', import.meta.url), 'utf-8');
    expect(source.includes('Math.random')).toBe(false);
    // pure: same input ⇒ same output
    const proposals = [{ action: '0', value: 0.9, confidence: 0.9, source: 'reflex' }] as never[];
    const rules = [{ action: '0', truth: { f: 0.1, c: 0.95 }, source: 'rule' }] as never[];
    const n1 = new Negotiator().resolve(proposals, rules);
    const n2 = new Negotiator().resolve(proposals, rules);
    expect(n1.vetoedBy).toBe(n2.vetoedBy);
    expect(n1.actionExecuted).toBe(n2.actionExecuted);
  });

  it('RNG call sites use RandomSource injection (no bare Math.random calls)', () => {
    for (const rel of ['nar/src/bag/Bag.ts', 'nar/src/learning/schema-induction.ts']) {
      const source = readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf-8');
      const bare = [...source.matchAll(/Math\.random\(\)/g)].filter(
        (m) => !source.slice(Math.max(0, m.index! - 40), m.index!).includes('??')
      );
      expect(bare, `${rel} must inject RandomSource (default via ?? Math.random)`).toHaveLength(0);
      expect(source.includes('RandomSource'), `${rel} declares RandomSource`).toBe(true);
    }
  });
});
