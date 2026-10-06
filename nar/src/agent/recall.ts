import { filterFolded } from '@senars/util';

/** Episodes matching a free-text query, newest first; empty without episodic memory. */
export const recallEpisodes = async (
  config: {
    episodicMemory?: { getEpisodes(o: { limit: number }): Promise<{ content: string }[]> };
  },
  query?: string,
  limit = 50
): Promise<{ content: string }[]> => {
  if (!config.episodicMemory) return [];
  const episodes = await config.episodicMemory.getEpisodes({ limit });
  return query ? filterFolded(episodes, query, (e) => e.content) : episodes;
};
