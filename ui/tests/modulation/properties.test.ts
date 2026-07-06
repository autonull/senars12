import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { evaluateModulation, compose, when, konst, field } from '../../src/client/modulation/operators.js';
import { evaluate, diffDelta } from '../../src/client/modulation/evaluate.js';
import { getMemoCache, resetMemoCache } from '../../src/client/modulation/memo.js';
import type { Item, View, Delta, Channel } from '../../src/client/modulation/types.js';
import { checkUnsupportedChannels, SUPPORT_3D, SUPPORT_3D_EDGES } from '../../src/client/spacegraph/adapter-3d.js';

const defaultView: View = {
  flags: { reducedMotion: false, highContrast: false, prefersColorScheme: 'dark' },
  timeline: { t: Number.POSITIVE_INFINITY },
};

function itemArbitrary(): fc.Arbitrary<Item> {
  return fc.record({
    id: fc.string({ minLength: 1 }),
    priority: fc.double({ min: 0, max: 1 }),
    confidence: fc.double({ min: 0, max: 1 }),
    nodeType: fc.constant('concept'),
    isContradiction: fc.boolean(),
    truth: fc.option(fc.record({ frequency: fc.double({ min: 0, max: 1 }), confidence: fc.double({ min: 0, max: 1 }) }), { nil: undefined }),
    occurrenceTime: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
  });
}

const identity: Modulation = { op: 'union', children: [] };

function deltaEquals(a: Delta, b: Delta): boolean {
  if (a.size !== b.size) return false;
  for (const [id, channels] of a) {
    const bCh = b.get(id);
    if (!bCh) return false;
    for (const [k, v] of Object.entries(channels)) {
      if (bCh[k as keyof typeof bCh] !== v) return false;
    }
  }
  return true;
}

describe('⊕ (union / compose)', () => {
  it('identity: compose(nothing, mod) ≡ mod', () => {
    fc.assert(
      fc.property(itemArbitrary(), fc.double({ min: 0, max: 1 }).filter(v => !Number.isNaN(v)), (item, val) => {
        const chMod = { op: 'channel' as const, channel: 'size' as Channel, child: konst(val) };
        const left = compose(identity, chMod);
        const right = chMod;
        const leftDelta = evaluateModulation(left, item, defaultView);
        const rightDelta = evaluateModulation(right, item, defaultView);
        expect(deltaEquals(leftDelta, rightDelta)).toBe(true);
      })
    );
  });

  it('identity: compose(mod, nothing) ≡ mod', () => {
    fc.assert(
      fc.property(itemArbitrary(), fc.double({ min: 0, max: 1 }).filter(v => !Number.isNaN(v)), (item, val) => {
        const chMod = { op: 'channel' as const, channel: 'size' as Channel, child: konst(val) };
        const left = compose(chMod, identity);
        const right = chMod;
        const leftDelta = evaluateModulation(left, item, defaultView);
        const rightDelta = evaluateModulation(right, item, defaultView);
        expect(deltaEquals(leftDelta, rightDelta)).toBe(true);
      })
    );
  });

  it('associativity: compose(a, compose(b, c)) ≡ compose(compose(a, b), c)', () => {
    fc.assert(
      fc.property(itemArbitrary(), (item) => {
        const a = { op: 'channel' as const, channel: 'color' as Channel, child: konst('#ff0000') };
        const b = { op: 'channel' as const, channel: 'size' as Channel, child: konst(50) };
        const c = { op: 'channel' as const, channel: 'opacity' as Channel, child: konst(0.5) };
        const left = compose(a, compose(b, c));
        const right = compose(compose(a, b), c);
        const leftDelta = evaluateModulation(left, item, defaultView);
        const rightDelta = evaluateModulation(right, item, defaultView);
        expect(deltaEquals(leftDelta, rightDelta)).toBe(true);
      })
    );
  });

  it('last-wins: later channel assignments override earlier ones', () => {
    fc.assert(
      fc.property(itemArbitrary(), fc.double(), fc.double(), (item, v1, v2) => {
        const a = { op: 'channel' as const, channel: 'size' as Channel, child: konst(v1) };
        const b = { op: 'channel' as const, channel: 'size' as Channel, child: konst(v2) };
        const combined = compose(a, b);
        const result = evaluateModulation(combined, item, defaultView);
        const record = result.get(item.id);
        expect(record?.size).toBe(v2);
      })
    );
  });
});

describe('When', () => {
  it('short-circuit: false predicate → no contribution', () => {
    fc.assert(
      fc.property(itemArbitrary(), fc.double(), (item, val) => {
        const w = when(() => false, { op: 'channel' as const, channel: 'size' as Channel, child: konst(val) });
        const result = evaluateModulation(w, item, defaultView);
        expect(result.size).toBe(0);
      })
    );
  });

  it('true predicate → child contribution flows through', () => {
    fc.assert(
      fc.property(itemArbitrary(), fc.double(), (item, val) => {
        const w = when(() => true, { op: 'channel' as const, channel: 'size' as Channel, child: konst(val) });
        const result = evaluateModulation(w, item, defaultView);
        const record = result.get(item.id);
        expect(record?.size).toBe(val);
      })
    );
  });

  it('predicate depends on item fields correctly', () => {
    fc.assert(
      fc.property(itemArbitrary(), (item) => {
        const w = when(
          (i) => (i.truth?.frequency ?? 0) > 0.5,
          { op: 'channel' as const, channel: 'color' as Channel, child: konst('#00ff00') }
        );
        const result = evaluateModulation(w, item, defaultView);
        const expectsContribution = (item.truth?.frequency ?? 0) > 0.5;
        expect(result.size > 0).toBe(expectsContribution);
      })
    );
  });
});

describe('Memo', () => {
  it('cache hit: second eval with same item returns cached record', () => {
    resetMemoCache();
    const item: Item = { id: 'test', priority: 0.5, confidence: 0.9, nodeType: 'concept' };
    const lens = {
      id: 'test-lens',
      label: 'Test',
      description: '',
      modulation: { op: 'channel' as const, channel: 'size' as Channel, child: konst(42) },
    };
    const result1 = evaluate([item], lens, defaultView, { dirtyIds: new Set() });
    expect(result1.get('test')?.size).toBe(42);
    // Second eval with same dirtyIds set (empty = nothing dirty) reuses cache
    const result2 = evaluate([item], lens, defaultView, { dirtyIds: new Set() });
    expect(result2.get('test')?.size).toBe(42);
    expect(result1.get('test')).toBe(result2.get('test'));
  });

  it('cache miss: dirty item forces re-evaluation', () => {
    resetMemoCache();
    const item1: Item = { id: 'test', priority: 0.5, confidence: 0.9, nodeType: 'concept' };
    const lens = {
      id: 'test-lens',
      label: 'Test',
      description: '',
      modulation: { op: 'channel' as const, channel: 'size' as Channel, child: field('priority', (v) => (v as number) * 100) },
    };
    const result1 = evaluate([item1], lens, defaultView, { dirtyIds: new Set() });
    expect(result1.get('test')?.size).toBe(50);
    const item2: Item = { ...item1, priority: 0.8 };
    const result2 = evaluate([item2], lens, defaultView, { dirtyIds: new Set(['test']) });
    expect(result2.get('test')?.size).toBe(80);
    expect(result2.get('test')).not.toBe(result1.get('test'));
  });

  it('memo cache is invalidated on clear', () => {
    resetMemoCache();
    const cache = getMemoCache();
    const item: Item = { id: 'test', priority: 0.5, confidence: 0.9, nodeType: 'concept' };
    const lens = {
      id: 'test-lens',
      label: 'Test',
      description: '',
      modulation: { op: 'channel' as const, channel: 'size' as Channel, child: konst(42) },
    };
    evaluate([item], lens, defaultView);
    expect(cache.getDelta('test')).toBeDefined();
    cache.clear();
    expect(cache.getDelta('test')).toBeUndefined();
  });
});

describe('diffDelta', () => {
  it('returns only changed entries', () => {
    const prev: Delta = new Map([['a', { color: '#ff0000', size: 30 }]]);
    const next: Delta = new Map([['a', { color: '#00ff00', size: 30 }]]);
    const diff = diffDelta(prev, next);
    expect(diff.get('a')).toEqual({ color: '#00ff00' });
    expect(diff.get('a')?.size).toBeUndefined();
  });

  it('new entries appear in diff', () => {
    const prev: Delta = new Map();
    const next: Delta = new Map([['b', { opacity: 0.5 }]]);
    const diff = diffDelta(prev, next);
    expect(diff.get('b')).toEqual({ opacity: 0.5 });
  });
});

describe('3D/2D Channel Equivalence', () => {
  it('supported channels in delta match 3D capabilities', () => {
    fc.assert(
      fc.property(itemArbitrary(), fc.double({ min: 0, max: 1 }), fc.double({ min: 0, max: 1 }), (item, priority, confidence) => {
        const testItem: Item = { ...item, priority, confidence };
        const lens = {
          id: 'test-lens',
          label: 'Test',
          description: '',
          modulation: compose(
            { op: 'channel' as const, channel: 'color' as Channel, child: konst('#ff0000') },
            { op: 'channel' as const, channel: 'opacity' as Channel, child: konst(0.5) },
            { op: 'channel' as const, channel: 'size' as Channel, child: konst(40) },
            { op: 'channel' as const, channel: 'z' as Channel, child: konst(100) }
          ),
        };
        const delta = evaluate([testItem], lens, defaultView);
        const unsupported = checkUnsupportedChannels(delta, () => false);
        expect(unsupported).toHaveLength(0);
      })
    );
  });

  it('z-axis mapping produces valid z values from occurrenceTime', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10000 }), (occurrenceTime) => {
        const item: Item = { id: 'test', priority: 0.5, confidence: 0.9, nodeType: 'concept', occurrenceTime };
        const lens = {
          id: 'temporal-lens',
          label: 'Temporal',
          description: '',
          modulation: { op: 'channel' as const, channel: 'z' as Channel, child: field('occurrenceTime', (v) => (v as number) / 1000) },
        };
        const delta = evaluate([item], lens, defaultView);
        expect(delta.get('test')?.z).toBe(occurrenceTime / 1000);
      })
    );
  });

  it('unsupported channels are detected for 3D viewport', () => {
    const prev: Delta = new Map([['a', { 'flow.enable': true } as Record<string, unknown>]]);
    const unsupported = checkUnsupportedChannels(prev, () => false);
    expect(unsupported).toContain('flow.enable');
  });
});
