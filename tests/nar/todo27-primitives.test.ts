import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BoundedMap, formatIssues, occupancy, SchemaValidationError } from '@senars/util';
import {
  formatNarseseTruth,
  parseNarseseTruth,
  parseTruthLiteral,
  serializeTruth,
} from '@senars/util';
import { createBudgetSlice, consumeCycles, pressure } from '@senars/kernel/budget';
import { Memory } from '@senars/nar/memory';
import { BoundaryValidationError } from '../../nar/src/errors/index.js';
import { SingleFlight } from '../../nar/src/nl/singleflight.js';
import { PriorityBag } from '../../nar/src/bag/Bag.js';
import { TermBuilder, atom, Truth } from '../../nar/src/terms/index.js';
import { mulberry32, weightedPick, weightedSampleBy } from '../../nar/src/utils/random.js';

/**
 * TODO27 Benches 112–114 — the primitives every other selection path defers to.
 *
 * Falsifies: "three weighted scans drift apart", "the similarity index is
 * written but never read", and "an unbounded in-flight map on an untrusted
 * input surface". Each bench fails if its change is reverted: 112 on the
 * distribution contract, 113 on ranking and the zero-similarity floor, 114 on
 * the cap.
 */

describe('Bench 112 — one weighted draw', () => {
  const weights = [3, 0, 1, 6];
  const slots = weights.map((_, index) => index);

  it('draws in proportion to weight and never draws a zero weight', () => {
    const rng = mulberry32(20260929);
    const counts = new Map<number, number>();
    for (let i = 0; i < 10_000; i++) {
      const picked = weightedPick(slots, (index) => weights[index]!, rng)!;
      counts.set(picked, (counts.get(picked) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([0, 2, 3]);
    for (const [index, expected] of [
      [0, 0.3],
      [2, 0.1],
      [3, 0.6],
    ] as const) {
      expect(counts.get(index)! / 10_000).toBeCloseTo(expected, 1);
    }
  });

  it('a pool carrying no weight has no distribution to draw from', () => {
    const rng = mulberry32(1);
    expect(weightedPick([0, 0, 0], (w) => w, rng)).toBeUndefined();
    expect(weightedPick([], (w) => w, rng)).toBeUndefined();
    expect(weightedPick(['dead', 'live'], (item) => (item === 'live' ? 4 : 0), rng)).toBe('live');
  });

  it('without-replacement sampling is a sequence of weighted draws', () => {
    const rng = mulberry32(7);
    const picked = weightedSampleBy(
      weights.map((weight, item) => ({ item, weight })),
      3,
      rng
    );
    expect(new Set(picked)).toEqual(new Set([0, 2, 3]));
    expect(weightedSampleBy([{ item: 'a', weight: 0 }], 2, rng)).toEqual(['a']);
  });
});

describe('Bench 113 — one similarity read path', () => {
  const memory = () => new Memory({ enableEmbeddingLayer: false });

  it('ranks by similarity and drops zero-similarity concepts', () => {
    const store = memory();
    const mammal = TermBuilder.inheritance(atom('cat'), atom('animal'))!;
    store.addConcept(mammal);
    store.addConcept(atom('cat'));
    store.addConcept(atom('unrelated'));

    expect(store.findSimilarConcepts(mammal).map((c) => c.term.toString())).toEqual([
      '(cat --> animal)',
      'cat',
    ]);
    expect(store.findSimilarConcepts(atom('missing'))).toEqual([]);
  });

  it('honours the limit', () => {
    const store = memory();
    const inheritance = (sub: string, sup: string) => TermBuilder.inheritance(atom(sub), atom(sup))!;
    store.addConcept(inheritance('cat', 'animal'));
    store.addConcept(inheritance('cat', 'plant'));
    store.addConcept(inheritance('dog', 'animal'));
    expect(store.findSimilarConcepts(inheritance('cat', 'animal'), 2)).toHaveLength(2);
    expect(store.findSimilarConcepts(inheritance('cat', 'animal'), 0)).toEqual([]);
  });

  it('answers from the store when indexing is off', () => {
    const store = new Memory({ enableEmbeddingLayer: false, enableIndexing: false });
    store.addConcept(atom('cat'));
    store.addConcept(atom('cathedral'));
    expect(store.findSimilarConcepts(atom('cat')).map((c) => c.term.toString())).toEqual(['cat']);
  });
});

describe('Bench 114 — in-flight requests are bounded', () => {
  it('never holds more than the cap, and every request still resolves', async () => {
    const flight = new SingleFlight({ maxInflight: 2 });
    const pending = new Map<string, Promise<unknown>>();
    const keys = ['a', 'b', 'c', 'd', 'e'];
    const results = keys.map((key) =>
      flight.run(key, () => {
        const promise = new Promise<string>((resolve) => setTimeout(() => resolve(key), 1));
        pending.set(key, promise);
        return promise;
      })
    );
    expect(flight.size).toBeLessThanOrEqual(2);
    expect(await Promise.all(results)).toEqual(keys);
    expect(flight.size).toBe(0);
  });

  it('coalesces a duplicate while the key is resident', async () => {
    const flight = new SingleFlight({ maxInflight: 4 });
    let calls = 0;
    const fn = async () => {
      calls++;
      return 'ok';
    };
    const [a, b] = [flight.run('k', fn), flight.run('k', fn)];
    expect(calls).toBe(1);
    expect(await Promise.all([a, b])).toEqual(['ok', 'ok']);
  });
});

describe('Bench 115 — one rendering of a schema failure', () => {
  it('names the failing field, and names it for every boundary that parses', () => {
    const parsed = z.object({ retries: z.number().int().min(1) }).safeParse({ retries: 0 });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const rendered = formatIssues(parsed.error.issues);
    expect(rendered).toBe('retries: Too small: expected number to be >=1');

    expect(new SchemaValidationError('agent-options', parsed.error.issues).message).toBe(
      `Invalid agent-options: ${rendered}`
    );
    expect(
      BoundaryValidationError.fromZod('agent-options', parsed.error).message
    ).toBe(`Validation failed at agent-options: ${rendered}`);
  });

  it('does not lose the path the way a message-only join does', () => {
    const loose = z.object({ a: z.string(), b: z.string() }).safeParse({});
    expect(loose.success).toBe(false);
    if (loose.success) return;

    const rendered = formatIssues(loose.error.issues);
    expect(rendered).toContain('a:');
    expect(rendered).toContain('b:');
    expect(new Set(rendered.split('; ')).size).toBe(2);
  });

  it('an empty issue list renders as nothing, not as a dangling separator', () => {
    expect(formatIssues([])).toBe('');
  });
});

describe('Bench 116 — truth literals round-trip through their own writer', () => {
  it('reads back what it writes, at every precision it writes', () => {
    for (const digits of [0, 1, 2, 4]) {
      const truth = { f: 0.7, c: 0.95 };
      // `toFixed` is itself lossy, so the contract is writer-then-reader is the
      // identity on what was written — not on what was passed in.
      const written = { f: Number(truth.f.toFixed(digits)), c: Number(truth.c.toFixed(digits)) };
      expect(parseTruthLiteral(serializeTruth(truth, digits))).toEqual(written);
      expect(
        parseNarseseTruth(`(cat --> animal)${formatNarseseTruth(truth, digits)}`)
      ).toEqual(written);
    }
  });

  it('a truth outside the term is not a truth', () => {
    expect(parseNarseseTruth('(cat --> animal).')).toBeUndefined();
    expect(parseNarseseTruth('port:8080:9090')).toBeUndefined();
    expect(parseTruthLiteral('0.7 0.95')).toBeUndefined();
  });

  it('the engine and the standalone verifier agree on what a literal means', () => {
    const truth = { f: 0.25, c: 0.75 };
    const deserialized = Truth.deserialize(serializeTruth(truth));
    expect(deserialized).not.toBeNull();
    expect(deserialized?.f).toBeCloseTo(truth.f, 6);
    expect(deserialized?.c).toBeCloseTo(truth.c, 6);
  });
});

describe('Bench 117 — one occupancy policy for bounded containers', () => {
  it('an unbounded container is under full pressure, not idle', () => {
    expect(occupancy(0, 0)).toBe(1);
    expect(occupancy(5, 0)).toBe(1);
    expect(occupancy(0, 10)).toBe(0);
    expect(occupancy(10, 10)).toBe(1);
    expect(occupancy(20, 10)).toBe(1);
  });

  it('the bag, the link map, and the budget slice all report a ratio', () => {
    expect(new BoundedMap<string, number>({ maxSize: 4 }).pressure()).toBe(0);
    const map = new BoundedMap<string, number>({ maxSize: 4 });
    map.set('a', 1);
    map.set('b', 2);
    expect(map.pressure()).toBe(0.5);

    const unlimited = new PriorityBag<{ id: string; priority: number }>({ capacity: 0 });
    expect(unlimited.pressure()).toBe(1);

    const slice = createBudgetSlice({
      id: 'root',
      totalCycles: 4,
      totalDepth: 0,
      totalMemoryOps: 0,
      totalLMCalls: 0,
    });
    expect(pressure(slice)).toBe(0);
    consumeCycles(slice, 4);
    expect(pressure(slice)).toBe(1);
  });
});
