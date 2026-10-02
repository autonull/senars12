#!/usr/bin/env tsx
/** §5.2 first cut: which structure maintains topK order, and at what N it matters.
 *  Run once with `pnpm exec tsx scripts/bench-topk.ts`. Numbers go to TODO30 §9. */
import { insertByScoreDesc, selectTopN, sortByDesc } from '../util/src/utils/collections.js';

type Scored = { id: string; priority: number };
const make = (n: number): Scored[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, priority: ((i * 2654435761) % 1000) / 1000 }));

const bench = (label: string, reps: number, fn: () => void): number => {
  fn();
  const ts: number[] = [];
  for (let i = 0; i < reps; i++) {
    const t0 = performance.now();
    fn();
    ts.push(performance.now() - t0);
  }
  ts.sort((a, b) => a - b);
  const median = ts[Math.floor(ts.length / 2)]!;
  console.log(`${label}: median ${median.toFixed(2)}ms over ${reps} reps`);
  return median;
};

for (const n of [1000, 10000, 100000]) {
  const items = make(n);
  for (const k of [20, 100]) bench(`selectTopN N=${n} K=${k}`, 5, () => void selectTopN(items, k, (c) => c.priority));
  bench(`sortByDesc N=${n}`, 5, () => void sortByDesc(items, (c) => c.priority));
}
for (const n of [100, 1000, 10000]) {
  bench(`sorted-insert admit bagSize=${n}`, 3, () => {
    const buf: Scored[] = [];
    const items = make(n);
    for (const it of items) insertByScoreDesc(buf, it, (c) => c.priority);
  });
}
