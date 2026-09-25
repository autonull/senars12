import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { Episode, EpisodeType, EpisodicMemory as UtilEpisodicMemory } from '@senars/util';
import { ulid } from 'ulid';

export type { EpisodicMemoryConfig } from '@senars/util';
export type { Episode, EpisodeType };

const DEFAULT_CONFIG = {
  enabled: true,
  basePath: '.cache/episodes',
  retentionDays: 30,
  maxEntriesPerFile: 10000,
} as const;

export class EpisodicMemory implements UtilEpisodicMemory {
  private readonly config: {
    enabled: boolean;
    basePath: string;
    retentionDays: number;
    maxEntriesPerFile: number;
  };
  private currentFile: string | null = null;
  private currentEntries = 0;
  private rolloverIndex = 0;
  private currentDay: string | null = null;
  /** D8: episodes dropped only if a rollover write itself fails. */
  static droppedTotal = 0;
  /** Phase D (REFACTOR.todo1): lazy metadata index — sessionId/correlationId filters without O(all) scans. */
  #index: Map<string, Episode[]> | null = null;

  constructor(
    config: Partial<{
      enabled: boolean;
      basePath: string;
      retentionDays: number;
      maxEntriesPerFile: number;
    }> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get basePath(): string {
    return this.config.basePath;
  }

  async log(
    type: EpisodeType,
    content: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    if (!this.config.enabled) return;

    // Phase D: reserved causal keys lift onto the Episode; everything else stays in metadata.
    const { id: causalId, causes, consequences, context, ...meta } = metadata;
    const episode: Episode = {
      timestamp: Date.now(),
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

    await this.appendToCurrentFile(JSON.stringify(episode));
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
    this.currentFile = null;
    this.currentEntries = 0;
    this.rolloverIndex = 0;
    this.currentDay = null;
  }

  // Internal methods (not part of the public interface)
  async getEpisodes(options?: {
    timeRange?: [number, number];
    type?: EpisodeType;
    limit?: number;
    sessionId?: string;
    correlationId?: string;
  }): Promise<Episode[]> {
    if (options?.sessionId || options?.correlationId) {
      const indexed = await this.#queryIndexed(options);
      if (indexed) return indexed;
    }
    return this.#scanEpisodes(options);
  }

  /** Phase D: indexed path — O(matches) after a one-time index build. */
  async #queryIndexed(options: {
    timeRange?: [number, number];
    type?: EpisodeType;
    limit?: number;
    sessionId?: string;
    correlationId?: string;
  }): Promise<Episode[] | null> {
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
    let matches = candidates.filter((e) => {
      if (options.type && e.type !== options.type) return false;
      if (options.timeRange) {
        const [start, end] = options.timeRange;
        if (e.timestamp < start || e.timestamp > end) return false;
      }
      return true;
    });
    if (options.limit !== undefined && matches.length > options.limit) {
      matches = matches.slice(-options.limit); // most recent wins, matching scan semantics
    }
    return matches;
  }

  /** One-time pass over all files, bucketing episodes by sessionId/correlationId. */
  async #buildIndex(): Promise<void> {
    const index = new Map<string, Episode[]>();
    const files = (await fs.readdir(this.config.basePath)).filter((f) => f.endsWith('.jsonl'));
    for (const file of files) {
      const content = await fs.readFile(join(this.config.basePath, file), 'utf-8');
      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        try {
          const episode = JSON.parse(line) as Episode;
          const cid = (episode.metadata as { correlationId?: unknown } | undefined)?.correlationId;
          const sid = (episode.metadata as { sessionId?: unknown } | undefined)?.sessionId;
          if (typeof cid === 'string') {
            const bucket = index.get(`cid:${cid}`) ?? [];
            bucket.push(episode);
            index.set(`cid:${cid}`, bucket);
          }
          if (typeof sid === 'string') {
            const bucket = index.get(`sid:${sid}`) ?? [];
            bucket.push(episode);
            index.set(`sid:${sid}`, bucket);
          }
        } catch {
          // Skip malformed entries
        }
      }
    }
    this.#index = index;
  }

  async #scanEpisodes(options?: {
    timeRange?: [number, number];
    type?: EpisodeType;
    limit?: number;
  }): Promise<Episode[]> {
    const episodes: Episode[] = [];
    const basePath = this.config.basePath;

    try {
      const files = await fs.readdir(basePath);
      const dateFiles = files
        .filter((f) => f.endsWith('.jsonl'))
        .sort()
        .reverse();

      for (const file of dateFiles) {
        if (episodes.length >= (options?.limit ?? Number.POSITIVE_INFINITY)) break;

        const filePath = join(basePath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter((line) => line.trim());

        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i];
          if (!line) continue;
          try {
            const episode = JSON.parse(line) as Episode;

            if (options?.type && episode.type !== options.type) continue;
            if (options?.timeRange) {
              const [start, end] = options.timeRange;
              if (episode.timestamp < start || episode.timestamp > end) continue;
            }

            episodes.push(episode);
            if (episodes.length >= (options?.limit ?? Number.POSITIVE_INFINITY)) break;
          } catch {
            // Skip malformed entries
          }
        }
      }
    } catch {
      // Directory may not exist yet
    }

    return episodes;
  }

  async pruneOldEpisodes(): Promise<void> {
    const basePath = this.config.basePath;
    const cutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;

    try {
      const files = await fs.readdir(basePath);
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;

        const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})(?:-\d+)?\.jsonl/);
        if (!dateMatch) continue;

        const dateStr = dateMatch[1];
        if (!dateStr) continue;
        const fileDate = new Date(dateStr).getTime();
        if (fileDate < cutoff) {
          await fs.unlink(join(basePath, file));
        }
      }
    } catch {
      // Directory may not exist
    }
  }

  async clear(): Promise<void> {
    try {
      await fs.rm(this.config.basePath, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
    this.currentFile = null;
    this.currentEntries = 0;
    this.rolloverIndex = 0;
    this.currentDay = null;
    this.#index = null;
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

  private async appendToCurrentFile(line: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0] as string;
    if (today !== this.currentDay) {
      this.currentDay = today;
      this.rolloverIndex = 0;
      // D17: retention sweep piggybacked on the daily rollover.
      void this.pruneOldEpisodes().catch(() => {});
    }
    // D8: at the per-file cap, roll over to `<date>-<n>.jsonl` instead of
    // silently dropping the episode.
    const fileName = (n: number) => (n === 0 ? `${today}.jsonl` : `${today}-${n}.jsonl`);
    const targetFile = join(this.config.basePath, fileName(this.rolloverIndex));

    if (this.currentFile !== targetFile) {
      this.currentFile = targetFile;
      this.currentEntries = 0;

      try {
        await fs.access(targetFile);
        const content = await fs.readFile(targetFile, 'utf-8');
        this.currentEntries = content.split('\n').filter((l) => l.trim()).length;
      } catch {
        await fs.mkdir(this.config.basePath, { recursive: true });
      }
    }

    if (this.currentEntries >= this.config.maxEntriesPerFile) {
      this.rolloverIndex++;
      this.currentFile = null;
      console.warn(
        `[episodic] cap ${this.config.maxEntriesPerFile} reached for ${fileName(this.rolloverIndex - 1)}; rolling over`
      );
      return this.appendToCurrentFile(line);
    }

    try {
      await fs.appendFile(targetFile, line + '\n');
      this.currentEntries++;
    } catch (error) {
      EpisodicMemory.droppedTotal++;
      throw error;
    }
  }
}
