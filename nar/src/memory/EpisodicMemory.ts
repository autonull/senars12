import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type {
  Episode,
  EpisodeType,
  EpisodicMemory as UtilEpisodicMemory,
  EpisodicMemoryConfig as UtilEpisodicMemoryConfig,
} from '@senars/util';

export type { EpisodicMemoryConfig } from '@senars/util';
export type { Episode, EpisodeType };

const DEFAULT_CONFIG = {
  enabled: true,
  basePath: '.cache/episodes',
  retentionDays: 30,
  maxEntriesPerFile: 10000,
} as const;

export class EpisodicMemory implements UtilEpisodicMemory {
  private readonly config: typeof DEFAULT_CONFIG;
  private currentFile: string | null = null;
  private currentEntries = 0;

  constructor(config: Partial<typeof DEFAULT_CONFIG> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async log(
    type: EpisodeType,
    content: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    if (!this.config.enabled) return;

    const episode: Episode = {
      timestamp: Date.now(),
      type,
      content,
      metadata,
    };

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
  }

  // Internal methods (not part of the public interface)
  async getEpisodes(options?: {
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

        const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})\.jsonl/);
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
    const today = new Date().toISOString().split('T')[0];
    const targetFile = join(this.config.basePath, `${today}.jsonl`);

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
      return;
    }

    await fs.appendFile(targetFile, line + '\n');
    this.currentEntries++;
  }
}
