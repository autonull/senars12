import type { Episode, EpisodicMemory, EpisodeType } from '../../util/src/types/episodic-memory.js';

/** Test double: in-memory conforming EpisodicMemory (no fs). */
export class InMemoryEpisodicMemory implements EpisodicMemory {
  readonly episodes: Episode[] = [];

  async log(type: EpisodeType, content: string, metadata: Record<string, unknown> = {}): Promise<void> {
    this.episodes.push({ timestamp: Date.now(), type, content, metadata });
  }

  async getRecent(limit = 5): Promise<Episode[]> {
    return this.episodes.slice(-limit);
  }

  async search(query: string, limit = 10): Promise<Episode[]> {
    return this.episodes.filter((e) => e.content.includes(query)).slice(0, limit);
  }

  async getEpisodes(options?: { type?: EpisodeType; limit?: number }): Promise<Episode[]> {
    const filtered = options?.type ? this.episodes.filter((e) => e.type === options.type) : this.episodes;
    return options?.limit !== undefined ? filtered.slice(-options.limit) : filtered;
  }

  async close(): Promise<void> {}
}
