/**
 * The bench harness every ad-hoc bench in this tree repeats: warm the
 * measurement, take `reps` samples, report the median.
 *
 * Three scripts had the same thirteen lines, down to the sort and the
 * `Math.floor(len / 2)`, and each spelled the median as its own index arithmetic
 * rather than `percentile` — so a number in `bench-topk` output and a number in
 * `bench-similarity` output were not necessarily the same statistic even though
 * both were labelled "median". One definition, and the label means one thing.
 */

import { percentile } from '@senars/util';

/**
 * Run `fn` `reps` times after one unmeasured warmup, print the median, and return
 * it. Synchronous: an async subject's harness shapes its own loop, because
 * guessing whether `fn` returns a promise would mean awaiting every sample.
 */
export const bench = (label: string, reps: number, fn: () => void): number => {
  fn();
  const samples = Array.from({ length: reps }, () => {
    const start = performance.now();
    fn();
    return performance.now() - start;
  });
  const median = percentile(samples, 0.5);
  console.log(`${label}: median ${median.toFixed(2)}ms over ${reps} reps`);
  return median;
};
