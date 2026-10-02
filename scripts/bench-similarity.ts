#!/usr/bin/env tsx
/** §5.3 first cut: which index answers similarity recall, and where admission turns quadratic.
 *  Run once with `pnpm exec tsx scripts/bench-similarity.ts`. Numbers go to TODO30 §9. */
import { Memory, TermBuilder } from '../nar/src/index.js';

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

const fill = (mem: Memory, n: number): void => {
  for (let i = 0; i < n; i++) mem.addConcept(TermBuilder.atom(`c${i}`));
};

for (const indexing of [true, false]) {
  for (const n of [1000, 10000]) {
    const mem = new Memory({ maxConcepts: 200000, enableIndexing: indexing, enableEmbeddingLayer: false });
    const t0 = performance.now();
    fill(mem, n);
    console.log(`addConcept x${n} indexing=${indexing}: total ${(performance.now() - t0).toFixed(1)}ms`);
    const q = TermBuilder.conjunction(TermBuilder.atom('c7'), TermBuilder.atom('c9999'));
    bench(`findSimilarConcepts N=${n} indexing=${indexing}`, 5, () => void mem.findSimilarConcepts(q, 10));
  }
}

const capped = new Memory({ maxConcepts: 500, enableIndexing: true, enableEmbeddingLayer: false });
fill(capped, 500);
let t0 = performance.now();
for (let i = 500; i < 1000; i++) capped.addConcept(TermBuilder.atom(`d${i}`));
console.log(`addConcept x500 at cap=500 (forgetting regime): total ${(performance.now() - t0).toFixed(1)}ms`);
const fresh = new Memory({ maxConcepts: 200000, enableIndexing: true, enableEmbeddingLayer: false });
fill(fresh, 500);
t0 = performance.now();
for (let i = 500; i < 1000; i++) fresh.addConcept(TermBuilder.atom(`e${i}`));
console.log(`addConcept x500 below cap (same 500->1000 range): total ${(performance.now() - t0).toFixed(1)}ms`);
