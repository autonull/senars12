import type { JudgmentProposition, JudgmentQuery, PropositionBase, ScoreDistribution } from '../../decision/types';
import type { ScoreLegend } from './types';
/** Shannon entropy in bits (log2). */
export declare const shannonEntropy: (distribution: readonly ScoreDistribution[]) => number;
export declare const topOption: (distribution: readonly ScoreDistribution[]) => ScoreDistribution | undefined;
/** Flat mass over an option space — what a head returns when it has nothing to discriminate. */
export declare const uniformDistribution: (options: readonly string[]) => ScoreDistribution[];
/** All mass on `dominantIdx`, the remainder spread evenly over the rest. */
export declare const dominantDistribution: (options: readonly string[], score: number, dominantIdx: number) => ScoreDistribution[];
/**
 * The legend kernel: a triangular bump centred on the score's position among the
 * level anchors, normalized to 1. One definition because two callers computed it
 * from different scores (raw vs calibrated) and could disagree about the same
 * proposition.
 */
export declare const legendFrom: (score: number, levels: readonly string[] | undefined) => ScoreLegend | undefined;
/**
 * What a backend decided. The derived half of a proposition — `top`, `entropy`,
 * `legend` — is arithmetic over this, not a backend's to state: three backends
 * each spelled the split themselves and a classify proposition could arrive with
 * a `top` that was not the option its own distribution put the mass on.
 */
export type PropositionVerdict = {
    kind: 'classify';
    distribution?: readonly ScoreDistribution[];
} | {
    kind: 'evaluate';
    score: number;
    legend?: ScoreLegend;
};
/**
 * The one place a proposition takes its kind. A backend states the verdict; the
 * composition here owns the `kind`/`axis` pair and everything that follows from
 * the verdict, so a backend cannot answer a classify query with an evaluate
 * payload and still typecheck.
 */
export declare const composeProposition: (query: JudgmentQuery, base: PropositionBase, verdict: PropositionVerdict) => JudgmentProposition;
//# sourceMappingURL=distribution.d.ts.map