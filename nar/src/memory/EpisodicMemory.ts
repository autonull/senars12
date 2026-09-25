import { z } from 'zod';
import { Ledger, createLedger, BaseLedgerEntrySchema, type LedgerQuery } from '@senars/io';
import type { Episode, EpisodeType, EpisodeFilter, EpisodicMemoryConfig, EpisodicMemory as UtilEpisodicMemory } from '@senars/util';
import { ulid } from 'ulid';
import { SystemClock, type Clock } from '../clock.js';
import { CausalIndex } from './CausalIndex.js';

export type { EpisodicMemoryConfig } from '@senars/util';
export type { Episode, EpisodeType };

const DEFAULT_CONFIG = {
  enabled: true,
  basePath: '.cache/episodes',
  retentionDays: 30,
  maxEntriesPerFile: 10000,
} as const;

/**
 * Episode schema for Ledger-backed EpisodicMemory.
 * Exported for test reuse and external ledger construction.
 */
export const EpisodeSchema = BaseLedgerEntrySchema.extend({
  type: z.enum(['input', 'response', 'belief_added', 'question', 'tool_call', 'error', 'dialogue', 'reaction']),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  id: z.string().optional(),
  causes: z.array(z.string()).optional(),
  consequences: z.array(z.string()).optional(),
  context: z.array(z.string()).optional(),
});

export type LedgerEpisode = z.infer<typeof EpisodeSchema>;

const matchesFilter = (e: Episode, options: EpisodeFilter): boolean => {
  const meta = e.metadata as { correlationId?: unknown; sessionId?: unknown } | undefined;
  if (options.correlationId && meta?.correlationId !== options.correlationId) return false;
  if (options.sessionId && meta?.sessionId !== options.sessionId) return false;
  if (options.type && e.type !== options.type) return false;
  if (options.timeRange) {
    const [start, end] = options.timeRange;
    if (e.timestamp < start || e.timestamp > end) return false;
  }
  if (options.causedBy && !(e.causes ?? []).includes(options.causedBy)) return false;
  if (options.leadingTo && !(e.consequences ?? []).includes(options.leadingTo)) return false;
  return true;
};

export class EpisodicMemory implements UtilEpisodicMemory {
  readonly #ledger: Ledger<LedgerEpisode>;
  readonly #config: {
    enabled: boolean;
    basePath: string;
    retentionDays: number;
    maxEntriesPerFile: number;
  };
  readonly #clock: Clock;
  /** Phase D: episodes dropped only if a rollover write itself fails. */
  static droppedTotal = 0;
  /** Phase D: lazy metadata index — sessionId/correlationId filters without O(all) scans. */
  #index: Map<string, Episode[]> | null = null;
  /** Phase A: lazy causal edge index — causedBy/leadingTo without O(all) scans. */
  #causal: CausalIndex | null = null;
  /** Phase B: optional admit sink — invoked after each successful append (best-effort). */
  onLogged?: (episode: Episode) => void;

  constructor(
    config: Partial<{
      enabled: boolean;
      basePath: string;
      retentionDays: number;
      maxEntriesPerFile: number;
      /** Injected time source (C8); defaults to `SystemClock`. */
      clock: Clock;
    }> = {}
  ) {
    const { clock, ...rest } = config;
    this.#config = { ...DEFAULT_CONFIG, ...rest };
    this.#clock = clock ?? SystemClock;

    this.#ledger = createLedger<LedgerEpisode>(this.#config.basePath, EpisodeSchema, {
      rollover: {
        daily: true,
        maxEntriesPerFile: this.#config.maxEntriesPerFile,
        retentionDays: this.#config.retentionDays,
      },
      onWrite: (entry) => {
        if (this.onLogged) {
          try {
            this.onLogged(entry as unknown as Episode);
          } catch {
            /* admit sink is best-effort; never fails the append */
          }
        }
      },
    });
  }

  get basePath(): string {
    return this.#config.basePath;
  }

  async log(
    type: EpisodeType,
    content: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    if (!this.#config.enabled) return;

    // Phase D: reserved causal keys lift onto the Episode; everything else stays in metadata.
    const { id: causalId, causes, consequences, context, ...meta } = metadata;
    const episode: Episode = {
      timestamp: this.#clock.now(),
      type,
      content,
      metadata: meta,
      id: typeof causalId === 'string' ? causalId : ulid(),
      ...(Array.isArray(causes) ? { causes: causes as string[] } : {}),
      ...(Array.isArray(consequences) ? { consequences: consequences as string[] } : {}),
      ...(Array.isArray(context) ? { context: context as string[] } : {}),
    };

    this.#index?.get(`cid:${meta.correlationId}`)?.push(episode);
    this.#index?.get(`sid:${meta.sessionId}`)?.push(episode);
    this.#causal?.add(episode);

    const ledgerEntry: LedgerEpisode = {
      at: episode.timestamp,
      correlationId: meta.correlationId as string | undefined,
      sessionId: meta.sessionId as string | undefined,
      type: episode.type,
      content: episode.content,
      metadata: episode.metadata,
      id: episode.id,
      causes: episode.causes,
      consequences: episode.consequences,
      context: episode.context,
    };

    this.#ledger.append(ledgerEntry);
  }

  async getRecent(limit = 5): Promise<Episode[]> {
    return this.getEpisodes({ limit });
  }

  async search(query: string, limit = 10): Promise<Episode[]> {
    const episodes = await this.getEpisodes({ limit });
    const lowerQuery = query.toLowerCase();
    return episodes.filter(
      (e) =>
        e.content.toLowerCase().includes(lowerQuery) ||
        JSON.stringify(e.metadata).toLowerCase().includes(lowerQuery)
    );
  }

  async close(): Promise<void> {
    this.#ledger.close();
  }

  // Internal methods (not part of the public interface)
  async getEpisodes(options?: EpisodeFilter): Promise<Episode[]> {
    if (options?.causedBy || options?.leadingTo) {
      const indexed = await this.#queryCausal(options);
      if (indexed) return indexed;
    }
    if (options?.sessionId || options?.correlationId) {
      const indexed = await this.#queryIndexed(options);
      if (indexed) return indexed;
    }
    return this.#scanEpisodes(options);
  }

  /** Phase A: indexed causal path — O(matches) after a one-time index build. */
  async #queryCausal(options: EpisodeFilter): Promise<Episode[] | null> {
    try {
      if (!this.#causal) await this.#buildCausalIndex();
    } catch {
      return null; // fall back to the scan path
    }
    const causal = this.#causal;
    if (!causal) return null;
    const sources: Episode[][] = [];
    if (options.causedBy) sources.push(causal.causedBy(options.causedBy));
    if (options.leadingTo) sources.push(causal.leadingTo(options.leadingTo));
    const candidates = sources.length === 1 ? sources[0]! : [...new Set(sources.flat())];
    let matches = candidates.filter((e) => matchesFilter(e, options));
    if (options.limit !== undefined && matches.length > options.limit) {
      matches = matches.slice(-options.limit); // most recent wins, matching scan semantics
    }
    return matches;
  }

  /** Phase D: indexed path — O(matches) after a one-time index build. */
  async #queryIndexed(options: EpisodeFilter): Promise<Episode[] | null> {
    try {
      if (!this.#index) await this.#buildIndex();
    } catch {
      return null; // fall back to the scan path
    }
    const index = this.#index;
    if (!index) return null;
    const sources: Episode[][] = [];
    if (options.correlationId) sources.push(index.get(`cid:${options.correlationId}`) ?? []);
    if (options.sessionId) sources.push(index.get(`sid:${options.sessionId}`) ?? []);
    const candidates = sources.length === 1 ? sources[0]! : [...new Set(sources.flat())]; // conjunction of provided keys
    let matches = candidates.filter((e) => matchesFilter(e, options));
    if (options.limit !== undefined && matches.length > options.limit) {
      matches = matches.slice(-options.limit); // most recent wins, matching scan semantics
    }
    return matches;
  }

  /** One-pass read of every persisted episode — both index builds share the traversal. */
  async #readAllEpisodes(visit: (episode: Episode) => void): Promise<void> {
    const entries = await this.#ledger.query({});
    for (const entry of entries) {
      const episode: Episode = {
        timestamp: entry.at,
        type: entry.type,
        content: entry.content,
        metadata: entry.metadata,
        id: entry.id,
        causes: entry.causes,
        consequences: entry.consequences,
        context: entry.context,
      };
      visit(episode);
    }
  }

  /** One-time pass over all files, bucketing episodes by sessionId/correlationId. */
  async #buildIndex(): Promise<void> {
    const index = new Map<string, Episode[]>();
    const entries = await this.#ledger.query({});
    for (const entry of entries) {
      const episode: Episode = {
        timestamp: entry.at,
        type: entry.type,
        content: entry.content,
        metadata: entry.metadata,
        id: entry.id,
        causes: entry.causes,
        consequences: entry.consequences,
        context: entry.context,
      };
      const meta = episode.metadata as { correlationId?: unknown; sessionId?: unknown } | undefined;
      if (typeof meta?.correlationId === 'string') {
        const bucket = index.get(`cid:${meta.correlationId}`) ?? [];
        bucket.push(episode);
        index.set(`cid:${meta.correlationId}`, bucket);
      }
      if (typeof meta?.sessionId === 'string') {
        const bucket = index.get(`sid:${meta.sessionId}`) ?? [];
        bucket.push(episode);
        index.set(`sid:${meta.sessionId}`, bucket);
      }
    }
    this.#index = index;
  }

  /** Phase A: one-time pass bucketing episodes by causal edges. */
  async #buildCausalIndex(): Promise<void> {
    const causal = new CausalIndex();
    const entries = await this.#ledger.query({});
    for (const entry of entries) {
      const episode: Episode = {
        timestamp: entry.at,
        type: entry.type,
        content: entry.content,
        metadata: entry.metadata,
        id: entry.id,
        causes: entry.causes,
        consequences: entry.consequences,
        context: entry.context,
      };
      causal.add(episode);
    }
    this.#causal = causal;
  }

  /** Fallback scan via ledger query. */
  async #scanEpisodes(options?: EpisodeFilter): Promise<Episode[]> {
    const filter: LedgerQuery = {};
    if (options?.correlationId) filter.correlationId = options.correlationId;
    if (options?.sessionId) filter.sessionId = options.sessionId;
    if (options?.timeRange) {
      filter.since = options.timeRange[0];
      filter.until = options.timeRange[1];
    }
    if (options?.limit) filter.limit = options.limit;

    const entries = await this.#ledger.query(filter);
    const episodes: Episode[] = [];

    for (const entry of entries) {
      const episode: Episode = {
        timestamp: entry.at,
        type: entry.type,
        content: entry.content,
        metadata: entry.metadata,
        id: entry.id,
        causes: entry.causes,
        consequences: entry.consequences,
        context: entry.context,
      };

      if (!matchesFilter(episode, options ?? {})) continue;
      episodes.push(episode);
    }

    // Sort by timestamp descending (most recent first)
    episodes.sort((a, b) => b.timestamp - a.timestamp);

    return episodes;
  }

  async pruneOldEpisodes(): Promise<void> {
    await this.#ledger.runRetentionSweep();
  }

  async clear(): Promise<void> {
    this.#ledger.close();
    await this.#ledger.compact(() => ''); // This will clear by rewriting with empty data
    this.#index = null;
    this.#causal = null;
  }

  async recallRecent(limit = 5): Promise<Episode[]> {
    return this.getEpisodes({ limit, type: 'input' });
  }

  async getRecentSummary(limit = 10): Promise<string> {
    const episodes = await this.getEpisodes({ limit });
    if (episodes.length === 0) return 'No recent episodes.';

    const recent = episodes.slice(0, 5);
    return recent
      .map((e) => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.type}: ${e.content}`)
      .join('\n');
  }
}