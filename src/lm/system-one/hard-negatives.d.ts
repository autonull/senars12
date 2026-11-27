import { type AikrBagOptions, AikrShell } from '../../learning/aikr-processor';
import type { EpisodicMemory } from '../../memory/EpisodicMemory';
import type { Task } from '../../types';
import type { ContrastiveMemory } from './contrastive';
import type { EmbeddingCache } from './types';
/** Read-only belief view a miner needs — keeps System One independent of the NAR facade. */
export interface BeliefSource {
    getBeliefs(): Task[];
}
export interface MinedNegative {
    /** Rubric the negative is hard for. */
    rubric: string;
    text: string;
    /** Provenance tag. */
    source: 'contradiction' | 'error-episode';
    /** 1 − max similarity to stored positives (bigger = more informative negative). */
    margin?: number;
}
export interface MineHardNegativesOptions {
    /** Max negatives per sweep (contradictions + errors combined). */
    limit?: number;
    /** Min absolute frequency gap for a contradiction pair to count. */
    conflictGap?: number;
    /** Phase D (REFACTOR.todo2): admit mined candidates into this bounded bag instead of only returning them. */
    into?: MiningBag;
}
/** Stable hash identity for mined negatives (joins the Z1 sidecar convention). */
export declare const hardNegativeId: (text: string) => string;
/**
 * Hard-negative mining (CLM) from existing SeNARS signals:
 * 1. NARS belief contradictions — same-term beliefs with divergent frequency.
 * 2. Episodic `error` episodes — failed tool calls / regressions.
 * Deterministic; reads only live NAR state + the episodic store.
 */
export declare function mineHardNegatives(beliefs: BeliefSource, episodic: EpisodicMemory | undefined, options?: MineHardNegativesOptions): Promise<MinedNegative[]>;
export interface HardNegativeCandidate {
    id: string;
    priority: number;
    negative: MinedNegative;
}
export interface MiningBagOptions extends AikrBagOptions {
    /** Drop candidates below this margin at drain time (default 0 — keep all). */
    marginFloor?: number;
    /** Injected clock for deterministic timestamps (default Date.now). */
    clock?: () => number;
}
export declare class MiningBag extends AikrShell<HardNegativeCandidate, MinedNegative, MinedNegative, MinedNegative> {
    constructor(options?: MiningBagOptions);
}
/**
 * Score margins against a ContrastiveMemory's stored positives and seed the
 * mined negatives under their rubrics. Returns exemplars actually stored.
 */
export declare function seedContrastiveMemory(negatives: readonly MinedNegative[], memory: ContrastiveMemory, cache: EmbeddingCache): Promise<number>;
/** Attach discrimination margins (1 − best positive cosine) to mined negatives. */
export declare function withMargins(negatives: readonly MinedNegative[], memory: ContrastiveMemory, cache: EmbeddingCache): Promise<MinedNegative[]>;
//# sourceMappingURL=hard-negatives.d.ts.map