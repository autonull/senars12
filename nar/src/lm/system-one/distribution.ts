import { maxBy, normalizeToSum } from '@senars/util';
import type { ScoreLegend } from './types.js';

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
): ScoreDistribution | undefined => maxBy(distribution, (d) => d.p, { option: '', p: 0 });

/** Flat mass over an option space — what a head returns when it has nothing to discriminate. */
export const uniformDistribution = (options: readonly string[]): ScoreDistribution[] =>
  options.map((option) => ({ option, p: 1 / Math.max(1, options.length) }));

/** All mass on `dominantIdx`, the remainder spread evenly over the rest. */
export const dominantDistribution = (
  options: readonly string[],
  score: number,
  dominantIdx: number
): ScoreDistribution[] => {
  const rest = (1 - score) / Math.max(1, options.length - 1);
  return options.map((option, i) => ({ option, p: i === dominantIdx ? score : rest }));
};

/**
 * The legend kernel: a triangular bump centred on the score's position among the
 * level anchors, normalized to 1. One definition because two callers computed it
 * from different scores (raw vs calibrated) and could disagree about the same
 * proposition.
 */
export const legendFrom = (
  score: number,
  levels: readonly string[] | undefined
): ScoreLegend | undefined => {
  if (!levels || levels.length < 2) return undefined;
  const n = levels.length;
  const weights = levels.map((_, i) => Math.max(0, 1 - Math.abs(score - i / (n - 1)) * (n - 1)));
  return { levels, weights: normalizeToSum(weights, (w) => w, weights) };
};
