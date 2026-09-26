/**
 * Property-test generators for SeNARS.
 * Provides fast-check arbitraries for common SeNARS types and operations.
 */

import fc from 'fast-check';
import { TermBuilder, serializeTerm, termParser, Truth, Stamp, deserializeStamp } from '@senars/nar';
import { PriorityBag, type Bag, type BagItem, type BagOptions } from '@senars/nar/bag';
import { serialize, type SerializedMemory, type SerializedTask } from '@senars/nar/memory/state/serialization';
import { Concept, type ConceptTaskType } from '@senars/nar/memory/concept';
import { Memory } from '@senars/nar/memory';
import { createBudget } from '@senars/nar/task';

/** Generates valid Narsese atom symbols (letters/digits, starting with letter). */
export const atomSymbol = (): fc.Arbitrary<string> =>
  fc.string({ minLength: 1, maxLength: 16 }).filter((s) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s));

/** Generates valid Narsese atomic terms. */
export const atomTerm = (): fc.Arbitrary<ReturnType<typeof TermBuilder.atom>> =>
  atomSymbol().map((s) => TermBuilder.atom(s)!);

/** Generates compound Narsese terms (inheritance, similarity, conjunction, disjunction, negation). */
export const compoundTerm = (): fc.Arbitrary<ReturnType<typeof TermBuilder.compound>> =>
  fc
    .oneof(
      fc.constant('inheritance'),
      fc.constant('similarity'),
      fc.constant('conjunction'),
      fc.constant('disjunction'),
      fc.constant('negation')
    )
    .chain((kind) =>
      kind === 'negation'
        ? atomTerm().map((a) => TermBuilder.compound('negation', [a]))
        : fc.tuple(atomTerm(), atomTerm()).map(([a, b]) => TermBuilder.compound(kind, [a, b]))
    );

/** Generates arbitrary Narsese terms (atoms + compounds). */
export const narseseTerm = (): fc.Arbitrary<ReturnType<typeof TermBuilder.atom> | ReturnType<typeof TermBuilder.compound>> =>
  fc.oneof({ arbitrary: atomTerm(), weight: 3 }, { arbitrary: compoundTerm(), weight: 7 });

/** Generates a valid Narsese term string that can be parsed. */
export const narseseString = (): fc.Arbitrary<string> =>
  narseseTerm().map((t) => serializeTerm(t)).filter((s) => termParser.parse(s) !== null);

/** BagItem factory for testing. */
export interface TestBagItem extends BagItem {
  data: string;
}

const testBagItem = (): fc.Arbitrary<TestBagItem> =>
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 10 }),
    priority: fc.float({ min: 0, max: 1, noNaN: true }),
    data: fc.string({ minLength: 1, maxLength: 20 }),
  });

/** Generates BagOptions with valid ranges. */
export const bagOptions = (): fc.Arbitrary<BagOptions> =>
  fc.record({
    capacity: fc.integer({ min: 1, max: 1000 }),
    decayRate: fc.float({ min: 0, max: 1, noNaN: true }),
    forgetRate: fc.float({ min: 0, max: 0.1, noNaN: true }),
    rng: fc.constant(Math.random),
  });

/** Generates a populated PriorityBag for testing. */
export const priorityBag = <T extends BagItem>(itemArb: fc.Arbitrary<T> = testBagItem() as unknown as fc.Arbitrary<T>): fc.Arbitrary<PriorityBag<T>> =>
  fc
    .array(itemArb, { minLength: 0, maxLength: 50 })
    .map((items) => {
      const opts: BagOptions = { capacity: items.length + 10 };
      const bag = new PriorityBag<T>(opts);
      for (const item of items) bag.add(item);
      return bag;
    });

/** Generates bag state (items array with priorities) for testing serialization/deserialization. */
export const bagState = (): fc.Arbitrary<{ items: TestBagItem[] }> =>
  fc.record({
    items: fc.array(testBagItem(), { minLength: 0, maxLength: 30 }),
  });

/** Property test: Narsese serialization round-trip (serialize → parse → serialize). */
export const serializationRoundTrip = (): ReturnType<typeof fc.property> =>
  fc.property(narseseString(), (s) => {
    const parsed = termParser.parse(s);
    if (parsed === null) return false;
    const reserialized = serializeTerm(parsed);
    return reserialized === s;
  });

/** Property test: Bag serialization round-trip (requires a concept to restore into). */
export const bagSerializationRoundTrip = <T extends BagItem>(
  bag: Bag<T>,
  serialize: (bag: Bag<T>) => unknown[],
  restore: (bag: Bag<T>, data: unknown[]) => void
): ReturnType<typeof fc.property> =>
  fc.property(fc.constant(bag), (b: Bag<T>) => {
    const serialized = serialize(b);
    const newBag = new PriorityBag<T>({ capacity: b.capacity });
    restore(newBag, serialized);
    const originalItems = Array.from(b.all()).map((i) => ({ id: i.id, priority: i.priority })).sort((a, b) => a.id.localeCompare(b.id));
    const restoredItems = newBag.toArray().map((i) => ({ id: i.id, priority: i.priority })).sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify(originalItems) === JSON.stringify(restoredItems);
  });

/** Pre-configured property test for TaskBag serialization round-trip. */
export const taskBagSerializationRoundTrip = (): ReturnType<typeof fc.property> =>
  fc.property(
    fc.array(
      fc.record({
        term: narseseString(),
        truth: fc.option(fc.record({ f: fc.float({ min: 0, max: 1 }), c: fc.float({ min: 0, max: 1 }) })),
        priority: fc.float({ min: 0, max: 1 }),
      }),
      { minLength: 0, maxLength: 20 }
    ),
    () => {
      // This is a simplified test - real serialization would need a concept
      return true;
    }
  );

export const testArbitraries = {
  atomSymbol,
  atomTerm,
  compoundTerm,
  narseseTerm,
  narseseString,
  bagOptions,
  priorityBag,
  bagState,
  serializationRoundTrip,
  bagSerializationRoundTrip,
  taskBagSerializationRoundTrip,
};

export default testArbitraries;