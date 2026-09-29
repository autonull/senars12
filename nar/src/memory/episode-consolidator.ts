/**
 * Phase B (REFACTOR.todo2): Memory Consolidation as a cognitive process —
 * the AIKR six-stage bag pattern applied to episodic persistence. Episodes
 * accumulate in a capacity-bounded bag (priority = salience × connections);
 * under pressure, structurally-similar episodes merge into *summary episodes*
 * emitted through the wired sink — append-only, raw episodes are never
 * deleted (I6-style: the summary is an index, not a replacement).
 */
import type { Episode, EpisodeType } from '@senars/util';
import { selectByPriority, sha256Hex, sha256Prefixed, shortSha256Hex } from '@senars/util';
import { AIKRProcessor, AikrShell, type ProcessOptions, type AikrBagOptions } from '../learning/aikr-processor.js';
import { PriorityBag } from '../bag/Bag.js';
import type { RandomSource } from '../types/primitives.js';

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
  (episode.causes?.length ?? 0) + (episode.consequences?.length ?? 0) + (episode.context?.length ?? 0);

/** Type-level salience (Phase B, REFACTOR.todo3): shared ranking prior. */
export const episodeSalience = (episode: Episode): number => {
  const kind = (episode.metadata as { kind?: unknown } | undefined)?.kind;
  return episode.type === 'reaction' && kind === 'correct' ? SALIENCE.reaction * 1.25 : SALIENCE[episode.type];
};

export interface EpisodeConsolidatorOptions extends AikrBagOptions {
  /** Max episodes merged per summary (default 6). */
  maxMerged?: number;
  /** Summary sink — typically `episodic.log('belief_added', …)`. Absent ⇒ results returned only. */
  emit?: (summary: Episode) => Promise<void> | void;
  /** Optional LM summarizer; null/exception ⇒ symbolic fallback. */
  summarizeWithLM?: (group: readonly Episode[]) => Promise<string>;
  /** Injected clock for deterministic timestamps (default Date.now). */
  clock?: () => number;
}

/**
 * Selection admits only episodes with at least one same-signature peer:
 * singletons have nothing to compress and would be lost by the drain —
 * they stay until peers arrive (or decay away, AIKR forgetting).
 * Priority-ordered and id-tiebroken: fully deterministic.
 */
const groupable = (items: readonly EpisodeCandidate[]): Map<string, EpisodeCandidate[]> => {
  const byKey = new Map<string, EpisodeCandidate[]>();
  for (const c of items) {
    const key = signature(c.episode);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(c);
    else byKey.set(key, [c]);
  }
  return byKey;
};

const signature = (e: Episode): string =>
  `${e.type}|${String((e.metadata as { correlationId?: unknown } | undefined)?.correlationId ?? '')}`;

export class EpisodeConsolidator extends AikrShell<EpisodeCandidate, ConsolidationResult, string, Episode> {
  readonly #maxMerged: number;
  #emit?: (summary: Episode) => Promise<void> | void;
  readonly #summarizeWithLM?: (group: readonly Episode[]) => Promise<string>;
  readonly #clock: () => number;

  constructor(options: EpisodeConsolidatorOptions = {}) {
    const bag = new PriorityBag<EpisodeCandidate>({
      capacity: options.capacity ?? 256,
      forgetRate: options.forgetRate,
      rng: options.rng,
      clock: options.clock,
    });
    super({
      bag,
      budget: options.budget ?? 8,
      view: (candidate) => candidate.id,
      admit: (episode) => ({
        id: episode.id ?? `${episode.timestamp}:${episode.content.slice(0, 32)}`,
        priority: episodeSalience(episode) * (1 + causalConnections(episode)),
        episode,
      }),
      processor: new AIKRProcessor<EpisodeCandidate, ConsolidationResult>({
        bag,
        pressureThreshold: options.pressureThreshold ?? 0.7,
        rng: options.rng,
        samplingStrategy: {
          name: 'groupable-priority',
          select: (items, budget) => {
            const byKey = groupable(items);
            const groupableItems: EpisodeCandidate[] = [];
            for (const bucket of byKey.values()) {
              if (bucket.length < 2) continue;
              groupableItems.push(...bucket);
            }
            return selectByPriority(groupableItems, budget);
          },
        },
        process: (items, signal) => this.#consolidate(items, signal),
      }),
    });
    this.#maxMerged = options.maxMerged ?? 6;
    this.#emit = options.emit;
    this.#summarizeWithLM = options.summarizeWithLM;
    this.#clock = options.clock ?? Date.now;
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
      const merged = bucket
        .slice()
        .sort(
          (a, b) =>
            a.episode.timestamp - b.episode.timestamp ||
            (a.episode.id ?? a.id).localeCompare(b.episode.id ?? b.id)
        )
        .slice(0, this.#maxMerged);
      const ids = merged.map((c) => c.episode.id ?? c.id);
      const causes = [...ids].sort();
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
  const heads = group
    .slice(0, 3)
    .map((e) => e.content.slice(0, 48))
    .join(' | ');
  return `consolidated ${group.length} ${group[0]?.type ?? 'episode'} episodes: ${heads}${
    group.length > 3 ? ' …' : ''
  }`;
};
