/**
 * Phase C (REFACTOR.todo2): cross-memory query facade (§15) — one read-only
 * entry point fanning a filter to concept memory (working/long-term bags),
 * episodic memory (indexed path), and semantic similarity. Results merge into
 * one ranked list (relevance = weighted priority/recency + embedding
 * similarity). Every leg is optional, bounded by `limit`, and mutating
 * nothing (C2').
 */
import type { Concept } from '../memory/index.js';
import type { Episode } from '@senars/util';
import type { EpisodicMemory } from '../memory/EpisodicMemory.js';
import type { Memory } from '../memory/index.js';

export interface MemoryQueryFilter {
  /** Substring/symbol filter over concept terms. */
  concept?: string;
  episodeType?: Episode['type'];
  timeRange?: [number, number];
  /** Floor under which results are dropped (concept priority / episode recency). */
  minPriority?: number;
  /** Semantic anchor; requires the `embed` dependency to score. */
  embedding?: Float32Array;
  /** Drop results whose semantic similarity falls below this (default 0). */
  similarityThreshold?: number;
  /** Bounded result count (default 20). */
  limit?: number;
}

export interface MemoryResult {
  source: 'concept' | 'episode';
  score: number;
  concept?: Concept;
  episode?: Episode;
}

export interface MemoryQueryOptions {
  memory: Memory;
  episodic?: EpisodicMemory;
  /** Text → embedding; absent ⇒ structural/leg-only scoring. */
  embed?: (text: string) => Promise<Float32Array | undefined> | Float32Array | undefined;
  weights?: { concept?: number; episodic?: number; semantic?: number };
}

const DEFAULT_LIMIT = 20;
const DEFAULT_WEIGHTS = { concept: 1, episodic: 1, semantic: 1 } as const;

const cosine = (a: Float32Array, b: Float32Array): number => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
};

/** Recency score ∈ (0, 1]: `1 / (1 + ageHours)`. */
const recency = (timestamp: number, now: number): number => 1 / (1 + (now - timestamp) / 3_600_000);

/**
 * Outcome surface from episodic quality signals (Phase C): groundedness
 * scores of dialogue turns joined with reaction-kind quality — replaces the
 * reaction-only proxy when a MemoryQuery is available; reaction mapping kept
 * as the fallback path.
 */
export const episodeQualitySurface = (
  episodes: readonly Episode[]
): { at: number; quality: number }[] => {
  const reactionQuality: Record<string, number> = {
    accept: 1,
    clarify: 0.5,
    redirect: 0.5,
    correct: 0,
    reject: 0,
    abandon: 0,
  };
  return episodes
    .map((e): { at: number; quality: number } | null => {
      if (e.type === 'dialogue') {
        const grounding = (e.metadata as { grounding?: { score?: number } } | undefined)?.grounding;
        return grounding && typeof grounding.score === 'number'
          ? { at: e.timestamp, quality: grounding.score }
          : null;
      }
      if (e.type === 'reaction') {
        const kind = String((e.metadata as { kind?: unknown } | undefined)?.kind ?? '');
        return { at: e.timestamp, quality: reactionQuality[kind] ?? 0.5 };
      }
      return null;
    })
    .filter((s): s is { at: number; quality: number } => s !== null)
    .sort((a, b) => a.at - b.at);
};

export class MemoryQuery {
  readonly #memory: Memory;
  readonly #episodic?: EpisodicMemory;
  readonly #embed?: MemoryQueryOptions['embed'];
  readonly #weights: { concept: number; episodic: number; semantic: number };

  constructor(options: MemoryQueryOptions) {
    this.#memory = options.memory;
    this.#episodic = options.episodic;
    this.#embed = options.embed;
    this.#weights = { ...DEFAULT_WEIGHTS, ...options.weights };
  }

  /** Merged, ranked, bounded results across the wired subsystems. */
  async search(filter: MemoryQueryFilter = {}): Promise<MemoryResult[]> {
    const limit = Math.max(filter.limit ?? DEFAULT_LIMIT, 0);
    if (limit === 0) return [];
    const now = Date.now();
    const anchor = filter.embedding !== undefined && this.#embed ? filter.embedding : undefined;
    const threshold = filter.similarityThreshold ?? 0;

    const results: MemoryResult[] = [];

    // Concept leg — substring/symbol fan-out, bounded.
    const conceptBudget = limit;
    const concepts = await this.#conceptsFor(filter, conceptBudget);
    for (const concept of concepts) {
      const priority = concept.priority;
      if (filter.minPriority !== undefined && priority < filter.minPriority) continue;
      const semantic = anchor ? await this.#similarity(anchor, concept.term.toString()) : undefined;
      if (semantic !== undefined && semantic < threshold) continue;
      results.push({
        source: 'concept',
        score:
          this.#weights.concept * priority + (semantic !== undefined ? this.#weights.semantic * semantic : 0),
        concept,
      });
    }

    // Episodic leg — indexed path, bounded.
    if (this.#episodic) {
      const episodes = await this.#episodic.getEpisodes({
        type: filter.episodeType,
        timeRange: filter.timeRange,
        limit: conceptBudget,
      });
      for (const episode of episodes) {
        const recencyScore = recency(episode.timestamp, now);
        if (filter.minPriority !== undefined && recencyScore < filter.minPriority) continue;
        const semantic = anchor ? await this.#similarity(anchor, episode.content) : undefined;
        if (semantic !== undefined && semantic < threshold) continue;
        results.push({
          source: 'episode',
          score:
            this.#weights.episodic * recencyScore +
            (semantic !== undefined ? this.#weights.semantic * semantic : 0),
          episode,
        });
      }
    }

    results.sort(
      (a, b) => b.score - a.score || this.#tiebreak(a) - this.#tiebreak(b) || this.#label(a).localeCompare(this.#label(b))
    );
    return results.slice(0, limit);
  }

  async #conceptsFor(filter: MemoryQueryFilter, budget: number): Promise<Concept[]> {
    if (filter.concept) return this.#memory.findConcepts(filter.concept, budget);
    if (filter.timeRange) {
      const [start, end] = filter.timeRange;
      return this.#memory.queryByTimeRange(start, end).slice(0, budget);
    }
    return [];
  }

  #similarity(anchor: Float32Array, text: string): Promise<number | undefined> {
    return Promise.resolve(this.#embed?.(text)).then((vec) =>
      vec ? cosine(anchor, vec) : undefined
    );
  }

  #tiebreak(r: MemoryResult): number {
    return r.source === 'episode' ? (r.episode?.timestamp ?? 0) : 0;
  }

  #label(r: MemoryResult): string {
    return r.source === 'episode' ? (r.episode?.id ?? '') : r.concept?.term.toString() ?? '';
  }
}
