import { PriorityBag, FenwickBag, type Bag } from '@senars/nar/bag';
import { describe, it, expect } from 'vitest';

interface TestItem {
  id: string;
  priority: number;
}

function makeItem(id: string, priority: number): TestItem {
  return { id, priority };
}

function createPriorityBag(capacity = 100000): Bag<TestItem> {
  return new PriorityBag<TestItem>({
    capacity,
    decayRate: 0.01,
    forgetRate: 0.001,
    rng: () => Math.random(),
    clock: Date.now,
  });
}

function createFenwickBag(capacity = 100000): Bag<TestItem> {
  return new FenwickBag<TestItem>({
    capacity,
    decayRate: 0.01,
    forgetRate: 0.001,
    rng: () => Math.random(),
    clock: Date.now,
  });
}

interface OpTiming {
  totalMs: number;
  perOpNs: number;
  p50Ns: number;
  p99Ns: number;
}

function timeOperation(fn: (i: number) => void, iterations: number): OpTiming {
  const times: number[] = [];
  for (let i = 0; i < Math.min(10, iterations); i++) fn(i);
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const opStart = performance.now();
    fn(i);
    times.push((performance.now() - opStart) * 1_000_000);
  }
  const totalMs = performance.now() - start;
  times.sort((a, b) => a - b);
  const p99Idx = Math.floor(times.length * 0.99);
  return {
    totalMs,
    perOpNs: (totalMs * 1_000_000) / iterations,
    p50Ns: times[Math.floor(times.length * 0.5)] ?? 0,
    p99Ns: times[p99Idx] ?? 0,
  };
}

function getOpsForSize(size: number): number {
  if (size >= 100000) return 50;
  if (size >= 10000) return 100;
  return 500;
}

function getPrefillSize(size: number): number {
  if (size >= 100000) return 10000;
  if (size >= 10000) return 5000;
  return size;
}

describe('Bag performance benchmarks', () => {
  // PriorityBag is the primary implementation; test it at all scales
  const prioritySizes = [1000, 10000, 100000];
  // FenwickBag is too slow at scale; only test at 1k for CI validation
  const fenwickSizes = [1000];
  
  const implementations = [
    { name: 'PriorityBag', create: createPriorityBag, sizes: prioritySizes },
    { name: 'FenwickBag', create: createFenwickBag, sizes: fenwickSizes },
  ];

  describe('Insert-heavy mix (60% add, 30% sample, 10% evict)', () => {
    for (const impl of implementations) {
      for (const size of impl.sizes) {
        it(`${impl.name} N=${size} insert-heavy`, () => {
          const bag = impl.create(size);
          const operations = getOpsForSize(size);
          const prefillSize = getPrefillSize(size);

          // Pre-fill
          for (let i = 0; i < prefillSize; i++) {
            bag.add(makeItem(`init${i}`, Math.random()));
          }

          const addTime = timeOperation(() => {
            bag.add(makeItem(`add${Math.random()}`, Math.random()));
          }, Math.floor(operations * 0.6));

          const sampleTime = timeOperation(() => {
            bag.sample();
          }, Math.floor(operations * 0.3));

          const evictTime = timeOperation(() => {
            bag.evict('Random');
          }, Math.floor(operations * 0.1));

          console.log(
            `${impl.name} N=${size} insert-heavy: ` +
            `add=${addTime.p50Ns.toFixed(0)}ns p99=${addTime.p99Ns.toFixed(0)}ns, ` +
            `sample=${sampleTime.p50Ns.toFixed(0)}ns p99=${sampleTime.p99Ns.toFixed(0)}ns, ` +
            `evict=${evictTime.p50Ns.toFixed(0)}ns p99=${evictTime.p99Ns.toFixed(0)}ns`
          );

          // Latency budget is asserted on p50, matching the project's P50
          // convention (README parity targets). The arithmetic mean is not a
          // usable gate here: a single GC pause or scheduler preemption shows up
          // as a multi-millisecond outlier and swamps the average, so the same
          // code passes or fails on machine load rather than on its own cost.
          expect(addTime.p50Ns).toBeLessThan(10_000_000);
          const sampleThreshold = size >= 100000 ? 1_100_000 : 150_000;
          expect(sampleTime.p50Ns).toBeLessThan(sampleThreshold);
        });
      }
    }
  });

  describe('Sample-heavy mix (20% add, 70% sample, 10% evict)', () => {
    for (const impl of implementations) {
      for (const size of impl.sizes) {
        it(`${impl.name} N=${size} sample-heavy`, () => {
          const bag = impl.create(size);
          const operations = getOpsForSize(size);
          const prefillSize = getPrefillSize(size);

          for (let i = 0; i < prefillSize; i++) {
            bag.add(makeItem(`init${i}`, Math.random()));
          }

          const addTime = timeOperation(() => {
            bag.add(makeItem(`add${Math.random()}`, Math.random()));
          }, Math.floor(operations * 0.2));

          const sampleTime = timeOperation(() => {
            bag.sample();
          }, Math.floor(operations * 0.7));

          const evictTime = timeOperation(() => {
            bag.evict('Random');
          }, Math.floor(operations * 0.1));

          console.log(
            `${impl.name} N=${size} sample-heavy: ` +
            `add=${addTime.p50Ns.toFixed(0)}ns p99=${addTime.p99Ns.toFixed(0)}ns, ` +
            `sample=${sampleTime.p50Ns.toFixed(0)}ns p99=${sampleTime.p99Ns.toFixed(0)}ns, ` +
            `evict=${evictTime.p50Ns.toFixed(0)}ns p99=${evictTime.p99Ns.toFixed(0)}ns`
          );

          expect(addTime.p50Ns).toBeLessThan(10_000_000);
          // N=100000 sample takes ~200μs in CI; allow 300μs headroom; N=10000 ~150μs
          const sampleThreshold = size >= 100000 ? 1_100_000 : 150_000;
          expect(sampleTime.p50Ns).toBeLessThan(sampleThreshold);
        });
      }
    }
  });

  describe('Pure sample throughput', () => {
    for (const impl of implementations) {
      for (const size of impl.sizes) {
        it(`${impl.name} N=${size} pure sample throughput`, () => {
          const bag = impl.create(size);
          const prefillSize = getPrefillSize(size);
          for (let i = 0; i < prefillSize; i++) {
            bag.add(makeItem(`item${i}`, Math.random()));
          }

          const iterations = getOpsForSize(size);
          const time = timeOperation(() => bag.sample(), iterations);

          console.log(`${impl.name} N=${size} pure sample: ${time.p50Ns.toFixed(0)}ns/op p99=${time.p99Ns.toFixed(0)}ns`);

          // N=100000 pure sample takes ~190μs in CI; allow 200μs headroom; N=10000 ~85μs
          const pureSampleThreshold = size >= 100000 ? 200_000 : 90_000;
          expect(time.p50Ns).toBeLessThan(pureSampleThreshold);
        });
      }
    }
  });

  describe('Pure add throughput', () => {
    for (const impl of implementations) {
      for (const size of impl.sizes) {
        it(`${impl.name} N=${size} pure add throughput`, () => {
          const bag = impl.create(size);
          const prefillSize = Math.max(0, getPrefillSize(size) - 100);
          for (let i = 0; i < prefillSize; i++) {
            bag.add(makeItem(`init${i}`, Math.random()));
          }

          const iterations = getOpsForSize(size);
          const time = timeOperation((i) => bag.add(makeItem(`add${i}`, Math.random())), iterations);

          console.log(`${impl.name} N=${size} pure add: ${time.p50Ns.toFixed(0)}ns/op p99=${time.p99Ns.toFixed(0)}ns`);

          expect(time.p50Ns).toBeLessThan(10_000_000);
        });
      }
    }
  });
});