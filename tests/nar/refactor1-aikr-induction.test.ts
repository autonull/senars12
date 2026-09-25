import { type BagItem, PriorityBag } from '@senars/nar/bag/Bag.js';
import {
  AIKRProcessor,
  FairnessSampling,
  PowerLawSampling,
  PriorityProportional,
  PrioritySampling,
  TopKSampling,
} from '@senars/nar/learning/aikr-processor.js';
import { SchemaInductor } from '@senars/nar/learning/schema-induction.js';
import { describe, expect, it } from 'vitest';

/** Deterministic LCG random source. */
const lcg = (seed: number) => (): number => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

const item = (id: string, priority: number): BagItem => ({ id, priority });

describe('Bench 83 — SamplingStrategy distributions', () => {
  const items = [item('a', 0.9), item('b', 0.5), item('c', 0.1)];

  it('softmax temperature sweep: T→0 greedy, high T flattens', () => {
    const greedy = new PrioritySampling<BagItem>(0.01).select(items, 1, Math.random);
    expect(greedy).toEqual([items[0]]);
    // T=1000 → near-uniform: all items reachable across many draws.
    const flattener = new PrioritySampling<BagItem>(1000);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const pick = flattener.select(items, 1, lcg(i + 1));
      if (pick[0]) seen.add(pick[0].id);
    }
    expect(seen.size).toBe(3);
  });

  it('power-law α>1 exploits the tail vs α<1', () => {
    const exploit = new PowerLawSampling<BagItem>(5);
    const picks: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 100; i++) {
      const pick = exploit.select(items, 1, lcg(i + 7));
      if (pick[0]) picks[pick[0].id]!++;
    }
    expect(picks.a).toBeGreaterThan(80);
    const explore = new PowerLawSampling<BagItem>(0.1);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const pick = explore.select(items, 1, lcg(i + 1));
      if (pick[0]) seen.add(pick[0].id);
    }
    expect(seen.size).toBe(3);
  });

  it('fairness aging boost guarantees aged items are eventually sampled', () => {
    const strategy = new FairnessSampling<BagItem>(1.0);
    const seen: Record<string, number> = { a: 0, b: 0, c: 0 };
    let rngState = 42;
    const rng = (): number => {
      rngState = (rngState * 48271) % 2147483647;
      return rngState / 2147483647;
    };
    for (let i = 0; i < 200; i++) {
      const pick = strategy.select(items, 1, rng);
      if (pick[0]) seen[pick[0].id]!++;
    }
    // Even the lowest-priority item receives a nonzero share.
    expect(seen.c).toBeGreaterThan(0);
    expect(seen.a).toBeGreaterThan(seen.c!);
  });

  it('top-k truncates to the k highest priorities then samples within', () => {
    const strategy = new TopKSampling<BagItem>(1.0, 1);
    for (let i = 0; i < 50; i++) {
      const pick = strategy.select(items, 1, lcg(i + 3));
      expect(pick[0]!.id).toBe('a');
    }
  });

  it('legacy proportional parity: same draws as PriorityBag.sample over identical priority order', () => {
    // PriorityBag.sample walks priority-sorted heap with the same roulette math.
    const bag = new PriorityBag<BagItem>({ capacity: 8, rng: lcg(11) });
    for (const it of items) bag.add(it);
    const legacySample = bag.sample();
    const proportional = new PriorityProportional<BagItem>().select(items, 1, lcg(11));
    expect(proportional[0]!.id).toBe(legacySample!.id);
  });

  it('selection never mutates the source order and respects budget', () => {
    const strategy = new PrioritySampling<BagItem>(1.0);
    const before = items.map((i) => i.id);
    const picked = strategy.select(items, 2, lcg(5));
    expect(picked).toHaveLength(2);
    expect(items.map((i) => i.id)).toEqual(before);
  });
});

describe('Bench 83 — AIKRProcessor', () => {
  const makeProcessor = (rng = Math.random) =>
    new AIKRProcessor<BagItem, BagItem>({
      bag: new PriorityBag<BagItem>({ capacity: 4, rng }),
      rng,
      process: (picked) => picked,
    });

  it('capacity eviction drops lowest priority', () => {
    const bag = new PriorityBag<BagItem>({ capacity: 3 });
    for (const it of [item('low', 0.1), item('mid', 0.5), item('high', 0.9)]) bag.add(it);
    bag.add(item('higher', 0.95));
    const ids = [...bag.all()].map((i) => i.id).sort();
    expect(ids).toEqual(['high', 'higher', 'mid']);
  });

  it('pressure threshold gates processIfPressured (inert below 0.7)', async () => {
    const processed: string[] = [];
    const p = new AIKRProcessor<BagItem, string>({
      bag: new PriorityBag<BagItem>({ capacity: 10 }),
      process: (picked) => picked.map((i) => i.id),
    });
    for (const it of [item('a', 1), item('b', 1)]) p.admit(it);
    expect(p.pressure()).toBeCloseTo(0.2);
    await expect(p.processIfPressured()).resolves.toEqual([]);
    p.admit(item('c', 1));
    p.admit(item('d', 1));
    p.admit(item('e', 1));
    p.admit(item('f', 1));
    p.admit(item('g', 1));
    p.admit(item('h', 1));
    p.admit(item('i', 1));
    p.admit(item('j', 1));
    expect(p.pressure()).toBeGreaterThanOrEqual(0.7);
    const out = await p.processIfPressured({ budget: 3 });
    expect(out.length).toBe(3);
    expect(processed).toEqual([]);
  });

  it('decay forgets stale items', () => {
    const bag = new PriorityBag<BagItem>({ capacity: 4, forgetRate: 0.2 });
    bag.add(item('x', 0.2));
    bag.decay(0.5);
    expect(bag.size()).toBe(0);
  });

  it('abort yields partial results; unprocessed items stay in the bag', async () => {
    const ctl = new AbortController();
    const p = new AIKRProcessor<BagItem, string>({
      bag: new PriorityBag<BagItem>({ capacity: 10 }),
      process: async (picked, signal) => {
        const out: string[] = [];
        for (const it of picked) {
          if (signal?.aborted) break;
          out.push(it.id);
          ctl.abort(); // abort after the first item
        }
        return out;
      },
    });
    for (const it of [item('a', 3), item('b', 2), item('c', 1)]) p.admit(it);
    const out = await p.process({ signal: ctl.signal, budget: 3 });
    expect(out).toHaveLength(1); // partial: only the first sampled item processed
    expect(p.size).toBe(3); // aborted batch is not consumed
  });

  it('determinism under a fixed RandomSource', async () => {
    const run = async (seed: number): Promise<string[]> => {
      let s = seed;
      const rng = (): number => {
        s = (s * 48271) % 2147483647;
        return s / 2147483647;
      };
      const p = makeProcessor(rng);
      for (const it of [item('a', 0.9), item('b', 0.5), item('c', 0.1), item('d', 0.3)])
        p.admit(it);
      const out = await p.process({ budget: 2 });
      p.decay(0.1);
      return out.map((i) => i.id);
    };
    expect(await run(99)).toEqual(await run(99));
  });
});

describe('Bench 83 — SchemaInductor as AIKR process', () => {
  const makeTask = (symbol: string, f = 0.9, c = 0.9) =>
    ({
      term: { kind: 'atom', symbol },
      truth: { f, c },
    }) as never;

  const chain = [makeTask('<a --> b>'), makeTask('<b --> c>'), makeTask('<a --> c>')];

  it('inert below pressure; admits accumulate in the bounded bag', async () => {
    const inductor = new SchemaInductor({} as never, {} as never, {
      enableSchemaInduction: true,
      inductionIntervalMs: 0,
      rng: lcg(3),
    });
    inductor.onDerivation(chain);
    expect(inductor.chainPressure).toBeLessThan(0.7);
    await expect(inductor.induceIfPressured()).resolves.toEqual([]);
  });

  it('LM failure falls back to symbolic structural induction', async () => {
    const inductor = new SchemaInductor(
      {} as never,
      { generateText: async () => 'not json' } as never,
      {
        enableSchemaInduction: true,
        inductionIntervalMs: 0,
        minDerivationSteps: 2,
        rng: lcg(3),
      }
    );
    // Fill the bag past the pressure threshold.
    for (let i = 0; i < 200; i++)
      inductor.onDerivation([chain[0], chain[1], chain[2], makeTask(`x${i}`)] as never);
    const results = await inductor.induceNow({ budget: 2 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.schema.template).toContain('?V');
    expect(results[0]!.schema.confidence).toBeGreaterThan(0);
  });

  it('duplicate chains are admitted once (novelty gate)', () => {
    const inductor = new SchemaInductor({} as never, {} as never, { enableSchemaInduction: true });
    for (let i = 0; i < 5; i++) inductor.onDerivation(chain);
    expect(inductor.chainPressure).toBeCloseTo(1 / 256, 5);
  });
});
