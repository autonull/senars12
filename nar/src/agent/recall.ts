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
  const needle = query?.toLowerCase();
  return needle ? episodes.filter((e) => e.content.toLowerCase().includes(needle)) : episodes;
};
