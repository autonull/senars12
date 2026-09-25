/**
 * Phase B (REFACTOR.todo2): Memory Consolidation as a cognitive process —
 * the AIKR six-stage bag pattern applied to episodic persistence. Episodes
 * accumulate in a capacity-bounded bag (priority = salience × connections);
 * under pressure, structurally-similar episodes merge into *summary episodes*
 * emitted through the wired sink — append-only, raw episodes are never
 * deleted (I6-style: the summary is an index, not a replacement).
 */
import { createHash } from 'node:crypto';
import type { Episode, EpisodeType } from '@senars/util';
import { AIKRProcessor, type ProcessOptions } from '../learning/aikr-processor.js';
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

export interface EpisodeConsolidatorOptions {
  /** Bag capacity (AIKR bound; default 256). */
  capacity?: number;
  /** Pressure threshold below which consolidation is inert (default 0.7). */
  pressureThreshold?: number;
  /** Priority floor below which decayed candidates are forgotten (bag forgetRate). */
  forgetRate?: number;
  /** Max episodes merged per summary (default 6). */
  maxMerged?: number;
  /** Default items examined per pass (default 8). */
  budget?: number;
  /** Injected randomness for sampling (default Math.random; symbolic path is deterministic regardless). */
  rng?: RandomSource;
  /** Summary sink — typically `episodic.log('belief_added', …)`. Absent ⇒ results returned only. */
  emit?: (summary: Episode) => Promise<void> | void;
  /** Optional LM summarizer; null/exception ⇒ symbolic fallback. */
  summarizeWithLM?: (group: readonly Episode[]) => Promise<string>;
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

export class EpisodeConsolidator {
  readonly #bag: PriorityBag<EpisodeCandidate>;
  readonly #processor: AIKRProcessor<EpisodeCandidate, ConsolidationResult>;
  readonly #maxMerged: number;
  readonly #budget: number;
  #emit?: (summary: Episode) => Promise<void> | void;
  readonly #summarizeWithLM?: (group: readonly Episode[]) => Promise<string>;

  constructor(options: EpisodeConsolidatorOptions = {}) {
    this.#maxMerged = options.maxMerged ?? 6;
    this.#budget = options.budget ?? 8;
    this.#emit = options.emit;
    this.#summarizeWithLM = options.summarizeWithLM;
    this.#bag = new PriorityBag<EpisodeCandidate>({
      capacity: options.capacity ?? 256,
      forgetRate: options.forgetRate,
      rng: options.rng,
    });
    this.#processor = new AIKRProcessor<EpisodeCandidate, ConsolidationResult>({
      bag: this.#bag,
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
          groupableItems.sort(
            (a, b) => b.priority - a.priority || a.id.localeCompare(b.id)
          );
          return groupableItems.slice(0, Math.max(budget, 0));
        },
      },
      process: (items, signal) => this.#consolidate(items, signal),
    });
  }

  /** Stage 1 — admit (bag enforces capacity + priority eviction). */
  admit(episode: Episode): boolean {
    const connections =
      (episode.causes?.length ?? 0) + (episode.consequences?.length ?? 0) + (episode.context?.length ?? 0);
    const kind = (episode.metadata as { kind?: unknown } | undefined)?.kind;
    const salience =
      episode.type === 'reaction' && kind === 'correct' ? SALIENCE.reaction * 1.25 : SALIENCE[episode.type];
    return this.#bag.add({
      id: episode.id ?? `${episode.timestamp}:${episode.content.slice(0, 32)}`,
      priority: salience * (1 + connections),
      episode,
    });
  }

  /** Stages 3–5 — sample groupable episodes, merge, emit summaries. */
  async consolidate(options: ProcessOptions = {}): Promise<ConsolidationResult[]> {
    return this.#processor.process({ ...options, budget: options.budget ?? this.#budget });
  }

  /** Inert below the pressure threshold (AIKR budget conservation). */
  async consolidateIfPressured(options: ProcessOptions = {}): Promise<ConsolidationResult[]> {
    return this.#processor.processIfPressured({
      ...options,
      budget: options.budget ?? this.#budget,
    });
  }

  /** Stage 6 — decay (forget stale episodes). */
  decay(rate?: number): void {
    this.#processor.decay(rate);
  }

  /** Wire the summary sink post-construction (integrator owns persistence). */
  setSink(emit: (summary: Episode) => Promise<void> | void): void {
    this.#emit = emit;
  }

  get pressure(): number {
    return this.#processor.pressure();
  }

  get size(): number {
    return this.#bag.size();
  }

  /** Bounded introspection: candidate ids currently bagged (diagnostics/tests). */
  peek(): string[] {
    return [...this.#bag.all()].map((i) => i.id);
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
      const merged = bucket
        .slice()
        .sort((a, b) => a.episode.timestamp - b.episode.timestamp)
        .slice(0, this.#maxMerged);
      const ids = merged.map((c) => c.episode.id ?? c.id);
      const causes = [...ids].sort();
      const summary: Episode = {
        timestamp: Date.now(),
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
        id: `consolidation:${createHash('sha256').update([...ids].sort().join(',')).digest('hex').slice(0, 16)}`,
        // The summary indexes the merged set (provenance), it never replaces it.
        causes,
      };
      await this.#emit?.(summary);
      results.push({ summary, merged: ids });
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
