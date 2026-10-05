import { flooredRatio, maxBy, normalizeToSum } from '@senars/util';
import type {
  JudgmentProposition,
  JudgmentQuery,
  PropositionBase,
  ScoreDistribution,
} from '../../decision/types.js';
import type { ScoreLegend } from './types.js';

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
  options.map((option) => ({ option, p: flooredRatio(1, options.length) }));

/** All mass on `dominantIdx`, the remainder spread evenly over the rest. */
export const dominantDistribution = (
  options: readonly string[],
  score: number,
  dominantIdx: number
): ScoreDistribution[] => {
  const rest = flooredRatio(1 - score, options.length - 1);
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

/**
 * What a backend decided. The derived half of a proposition — `top`, `entropy`,
 * `legend` — is arithmetic over this, not a backend's to state: three backends
 * each spelled the split themselves and a classify proposition could arrive with
 * a `top` that was not the option its own distribution put the mass on.
 */
export type PropositionVerdict =
  | { kind: 'classify'; distribution?: readonly ScoreDistribution[] }
  | { kind: 'evaluate'; score: number; legend?: ScoreLegend };

/**
 * The one place a proposition takes its kind. A backend states the verdict; the
 * composition here owns the `kind`/`axis` pair and everything that follows from
 * the verdict, so a backend cannot answer a classify query with an evaluate
 * payload and still typecheck.
 */
export const composeProposition = (
  query: JudgmentQuery,
  base: PropositionBase,
  verdict: PropositionVerdict
): JudgmentProposition => {
  if (verdict.kind === 'classify') {
    const distribution =
      verdict.distribution ??
      dominantDistribution(query.kind === 'classify' ? query.space : [], 1, 0);
    return {
      ...base,
      kind: 'classify',
      axis: query.axis,
      distribution,
      top: topOption(distribution)!,
      entropy: shannonEntropy(distribution),
    };
  }
  return {
    ...base,
    kind: 'evaluate',
    axis: query.axis,
    score: verdict.score,
    legend:
      verdict.legend ??
      legendFrom(verdict.score, query.kind === 'evaluate' ? query.levels : undefined),
  };
};
