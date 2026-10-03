import { createBag, resolveBagSlot } from '@senars/nar/bag';
import { createDefaultRegistry } from '@senars/nar/cognitive';
import { mulberry32 } from '@senars/util';
import { describe, expect, it } from 'vitest';
import { Memory, TermBuilder } from '../../nar/src';
import type { SamplingStrategy } from '../../nar/src/strategies';

/**
 * TODO27 Bench 110 — seeding a NAR seeds everything it samples from.
 *
 * Falsifies: "`NARConfig.rng` is decorative, because the memory bags and the
 * stochastic strategies draw from `Math.random` behind the config's back". The
 * registry hands its stream to every factory (§16), the bag slot carries the
 * same stream into every concept bag and the link layer, so one seed fixes the
 * whole stochastic path.
 */

const SEED = 20_240_928;

const terms = (count: number) =>
  Array.from({ length: count }, (_, i) => TermBuilder.atom(`entity_${i}`));

const memoryWith = (rng?: () => number): Memory => {
  const memory = new Memory({ maxConcepts: 50, bag: resolveBagSlot({ type: 'priority' }, rng) });
  for (const term of terms(12)) memory.addConcept(term);
  return memory;
};

const sample = (memory: Memory, count: number): string[] =>
  memory.topConcepts(count).map((c) => c.term.toString());

describe('Bench 110 — one seed, one stochastic path', () => {
  it('two memories on the same seed draw the same sample', () => {
    expect(sample(memoryWith(mulberry32(SEED)), 4)).toEqual(
      sample(memoryWith(mulberry32(SEED)), 4)
    );
  });

  it("the bag slot's stream reaches the bag it builds", () => {
    const draw = (rng: () => number) => {
      const bag = createBag<{ id: string; priority: number }>({
        capacity: 4,
        implementation: 'priority',
        rng,
      });
      for (let i = 0; i < 4; i++) bag.add({ id: `i_${i}`, priority: 1 });
      return bag.sampleMany(2).map((item) => item.id);
    };
    expect(draw(mulberry32(SEED))).toEqual(draw(mulberry32(SEED)));
  });

  it('a stochastic strategy draws from the registry stream, not Math.random', () => {
    const draws = (seed: number) => {
      const memory = memoryWith(mulberry32(SEED));
      const strategy = createDefaultRegistry({ rng: mulberry32(seed) }).resolve<SamplingStrategy>(
        'sampling',
        'windowed-roulette'
      );
      return strategy.sample(memory, 3).map((c) => c.term.toString());
    };
    expect(draws(1)).toEqual(draws(1));
  });

  it("a strategy's own `seed` still pins it independently of the ambient stream", () => {
    const draws = (ambientSeed: number) => {
      const memory = memoryWith(mulberry32(SEED));
      const strategy = createDefaultRegistry({
        rng: mulberry32(ambientSeed),
      }).resolve<SamplingStrategy>('sampling', 'windowed-roulette', { windowSize: 5, seed: 7 });
      return strategy.sample(memory, 3).map((c) => c.term.toString());
    };
    expect(draws(1)).toEqual(draws(999));
  });
});
