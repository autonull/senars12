/**
 * Phase B (REFACTOR.todo2): Memory Consolidation as a cognitive process —
 * the AIKR six-stage bag pattern applied to episodic persistence. Episodes
 * accumulate in a capacity-bounded bag (priority = salience × connections);
 * under pressure, structurally-similar episodes merge into *summary episodes*
 * emitted through the wired sink — append-only, raw episodes are never
 * deleted (I6-style: the summary is an index, not a replacement).
 */
import type { Episode, EpisodeType } from '@senars/util';
import {
  type Clock,
  groupBy,
  rankBy,
  selectByPriority,
  sha256Hex,
  sha256Prefixed,
  shortSha256Hex,
  softFalloff,
  systemClock,
  takeFirst,
} from '@senars/util';
import { type AikrBagOptions, AikrShell, type ProcessOptions } from '../learning/aikr-processor.js';
import type { RandomSource } from '../types/primitives.js';

/** Episodes examined per consolidation pass — a merge needs a group, so batches run wide. */
const EPISODE_CONSOLIDATION_BUDGET = 8;

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

/** Per-type importance: corrections/reactions outweigh routine traffic. */
const SALIENCE: Record<EpisodeType, number> = {
  reaction: 1.0,
  error: 0.9,
  dialogue: 0.8,
  question: 0.6,
  belief_added: 0.5,
  input: 0.5,
  response: 0.5,
  tool_call: 0.4,
};

/** Causal fan-in/out degree (Phase B, REFACTOR.todo3): shared ranking prior. */
export const causalConnections = (episode: Episode): number =>
  (episode.causes?.length ?? 0) +
  (episode.consequences?.length ?? 0) +
  (episode.context?.length ?? 0);

/** Type-level salience (Phase B, REFACTOR.todo3): shared ranking prior. */
export const episodeSalience = (episode: Episode): number => {
  const kind = (episode.metadata as { kind?: unknown } | undefined)?.kind;
  return episode.type === 'reaction' && kind === 'correct'
    ? SALIENCE.reaction * 1.25
    : SALIENCE[episode.type];
};

/** Recency score in (0, 1]: `softFalloff` of the age in hours. */
export const episodeRecency = (timestamp: number, now: number): number =>
  softFalloff((now - timestamp) / 3_600_000);

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
export const episodePriority = (episode: Episode, now?: number): number => {
  const intrinsic = episodeSalience(episode) * (1 + causalConnections(episode));
  return now === undefined ? intrinsic : episodeRecency(episode.timestamp, now) * intrinsic;
};

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

/**
 * Selection admits only episodes with at least one same-signature peer:
 * singletons have nothing to compress and would be lost by the drain —
 * they stay until peers arrive (or decay away, AIKR forgetting).
 * Priority-ordered and id-tiebroken: fully deterministic.
 */
const groupable = (items: readonly EpisodeCandidate[]): Map<string, EpisodeCandidate[]> => {
  return groupBy(items, (c) => signature(c.episode));
};

const signature = (e: Episode): string =>
  `${e.type}|${String((e.metadata as { correlationId?: unknown } | undefined)?.correlationId ?? '')}`;

export class EpisodeConsolidator extends AikrShell<
  EpisodeCandidate,
  ConsolidationResult,
  string,
  Episode
> {
  readonly #maxMerged: number;
  #emit?: (summary: Episode) => Promise<void> | void;
  readonly #summarizeWithLM?: (group: readonly Episode[]) => Promise<string>;
  readonly #clock: () => number;

  constructor(options: EpisodeConsolidatorOptions = {}) {
    super({
      capacity: options.capacity ?? 256,
      forgetRate: options.forgetRate,
      rng: options.rng,
      clock: options.clock,
      pressureThreshold: options.pressureThreshold,
      budget: options.budget ?? EPISODE_CONSOLIDATION_BUDGET,
      view: (candidate) => candidate.id,
      admit: (episode) => ({
        id: episode.id ?? `${episode.timestamp}:${episode.content.slice(0, 32)}`,
        priority: episodePriority(episode),
        episode,
      }),
      samplingStrategy: 'groupable-priority',
      select: (items, budget) => {
        const groupableItems: EpisodeCandidate[] = [];
        for (const bucket of groupable(items).values()) {
          if (bucket.length < 2) continue;
          groupableItems.push(...bucket);
        }
        return selectByPriority(groupableItems, budget);
      },
      process: (items, signal) => this.#consolidate(items, signal),
    });
    this.#maxMerged = options.maxMerged ?? 6;
    this.#emit = options.emit;
    this.#summarizeWithLM = options.summarizeWithLM;
    this.#clock = options.clock ?? systemClock;
  }

  /** Stages 3–5 — sample groupable episodes, merge, emit summaries. */
  consolidate(options: ProcessOptions = {}): Promise<ConsolidationResult[]> {
    return this.drain(options);
  }

  /** Inert below the pressure threshold (AIKR budget conservation). */
  consolidateIfPressured(options: ProcessOptions = {}): Promise<ConsolidationResult[]> {
    return this.drainIfPressured(options);
  }

  /** Wire the summary sink post-construction (integrator owns persistence). */
  setSink(emit: (summary: Episode) => Promise<void> | void): void {
    this.#emit = emit;
  }

  async #consolidate(
    items: readonly EpisodeCandidate[],
    signal?: AbortSignal
  ): Promise<ConsolidationResult[]> {
    const byKey = groupable(items);
    const results: ConsolidationResult[] = [];
    for (const bucket of byKey.values()) {
      if (bucket.length < 2) continue; // nothing to compress — retained via selection
      if (signal?.aborted) break;
      // Total order: `timestamp` alone ties for every episode admitted within the same
      // millisecond, letting clock granularity leak into the summary content. Tiebreak on id.
      const merged = rankBy(bucket, (c) => c.episode.timestamp, {
        tiebreak: (a, b) => (a.episode.id ?? a.id).localeCompare(b.episode.id ?? b.id),
        limit: this.#maxMerged,
      });
      const ids = merged.map((c) => c.episode.id ?? c.id);
      const causes = ids.toSorted();
      const summary: Episode = {
        timestamp: this.#clock(),
        type: 'belief_added',
        content: await this.#summarize(merged.map((c) => c.episode)),
        metadata: {
          kind: 'consolidation',
          summaryOf: ids,
          // Reserved keys ride in metadata so a naive `log(type, content, metadata)`
          // round-trip lifts them onto the persisted episode.
          causes,
          ...(typeof (merged[0]!.episode.metadata as { correlationId?: unknown }).correlationId ===
          'string'
            ? {
                correlationId: (merged[0]!.episode.metadata as { correlationId?: string })
                  .correlationId,
              }
            : {}),
        },
        id: `consolidation:${shortSha256Hex([...ids].sort().join(','))}`,
        // The summary indexes the merged set (provenance), it never replaces it.
        causes,
      };
      await this.#emit?.(summary);
      results.push({ summary, merged: ids, scanned: items.length });
    }
    return results;
  }

  /** LM summarization when wired; null/exception ⇒ symbolic structural merge. */
  async #summarize(group: readonly Episode[]): Promise<string> {
    if (this.#summarizeWithLM) {
      try {
        const text = await this.#summarizeWithLM(group);
        if (text) return text;
      } catch {
        // fall through to the symbolic path
      }
    }
    return symbolicSummary(group);
  }
}

/**
 * Symbolic fallback summary: deterministic, bounded, no LM. Rendered by the
 * caller via `symbolicSummary` when the LM path yields nothing.
 */
export const symbolicSummary = (group: readonly Episode[]): string => {
  const heads = takeFirst(group, 3)
    .map((e) => e.content.slice(0, 48))
    .join(' | ');
  return `consolidated ${group.length} ${group[0]?.type ?? 'episode'} episodes: ${heads}${
    group.length > 3 ? ' …' : ''
  }`;
};
