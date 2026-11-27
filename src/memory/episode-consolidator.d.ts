/**
 * Phase B (REFACTOR.todo2): Memory Consolidation as a cognitive process —
 * the AIKR six-stage bag pattern applied to episodic persistence. Episodes
 * accumulate in a capacity-bounded bag (priority = salience × connections);
 * under pressure, structurally-similar episodes merge into *summary episodes*
 * emitted through the wired sink — append-only, raw episodes are never
 * deleted (I6-style: the summary is an index, not a replacement).
 */
import type { Episode } from '@senars/types/episodic-memory';
import { type Clock } from '@senars/util/clock';
import { type AikrBagOptions, AikrShell, type ProcessOptions } from '../learning/aikr-processor';
/** Bag item: an episode awaiting consolidation. */
export interface EpisodeCandidate {
    id: string;
    priority: number;
    episode: Episode;
}
export interface ConsolidationResult {
    /** The emitted summary episode (append-only; never replaces the raw set). */
    summary: Episode;
    /** Raw episode ids merged into this summary. */
    merged: string[];
    /** Number of episodes scanned during consolidation. */
    scanned: number;
}
/** Causal fan-in/out degree (Phase B, REFACTOR.todo3): shared ranking prior. */
export declare const causalConnections: (episode: Episode) => number;
/** Type-level salience (Phase B, REFACTOR.todo3): shared ranking prior. */
export declare const episodeSalience: (episode: Episode) => number;
/** Recency score in (0, 1]: `softFalloff` of the age in hours. */
export declare const episodeRecency: (timestamp: number, now: number) => number;
/**
 * The one ranking prior every episodic surface scores by: salience × causal
 * reinforcement, with recency on top once the caller has a clock to read it
 * against.
 *
 * The two halves were separate products at two call sites, and one of them
 * carried a comment saying it matched the other — so agreement was asserted
 * rather than shared, and a change to either factor reached only one of the
 * surfaces. Admission passes no `now` because a just-arrived episode has no
 * history to be stale against; retrieval does, because that is the question
 * being asked.
 */
export declare const episodePriority: (episode: Episode, now?: number) => number;
export interface EpisodeConsolidatorOptions extends AikrBagOptions {
    /** Max episodes merged per summary (default 6). */
    maxMerged?: number;
    /** Summary sink — typically `episodic.log('belief_added', …)`. Absent ⇒ results returned only. */
    emit?: (summary: Episode) => Promise<void> | void;
    /** Optional LM summarizer; null/exception ⇒ symbolic fallback. */
    summarizeWithLM?: (group: readonly Episode[]) => Promise<string>;
    /** Injected clock for deterministic timestamps (default Date.now). */
    clock?: Clock;
}
export declare class EpisodeConsolidator extends AikrShell<EpisodeCandidate, ConsolidationResult, string, Episode> {
    #private;
    constructor(options?: EpisodeConsolidatorOptions);
    /** Stages 3–5 — sample groupable episodes, merge, emit summaries. */
    consolidate(options?: ProcessOptions): Promise<ConsolidationResult[]>;
    /** Inert below the pressure threshold (AIKR budget conservation). */
    consolidateIfPressured(options?: ProcessOptions): Promise<ConsolidationResult[]>;
    /** Wire the summary sink post-construction (integrator owns persistence). */
    setSink(emit: (summary: Episode) => Promise<void> | void): void;
}
/**
 * Symbolic fallback summary: deterministic, bounded, no LM. Rendered by the
 * caller via `symbolicSummary` when the LM path yields nothing.
 */
export declare const symbolicSummary: (group: readonly Episode[]) => string;
//# sourceMappingURL=episode-consolidator.d.ts.map