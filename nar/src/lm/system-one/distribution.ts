import { maxBy } from '@senars/util';

export interface ScoreDistribution {
  readonly option: string;
  readonly p: number;
}

/** Shannon entropy in bits (log2). */
export const shannonEntropy = (distribution: readonly ScoreDistribution[]): number => {
  let h = 0;
  for (const { p } of distribution) if (p > 0) h -= p * Math.log2(p);
  return h;
};

export const topOption = (
  distribution: readonly ScoreDistribution[]
): ScoreDistribution | undefined =>
  maxBy(distribution, (d) => d.p, { option: '', p: 0 });
