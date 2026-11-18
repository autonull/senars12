import type { CommandDefinition } from '@senars/util';
import type { EpisodicMemory } from '../memory/EpisodicMemory.js';
import { requiring } from './utils.js';

interface NarWithEpisodes {
  getEpisodicMemory?(): EpisodicMemory | undefined;
}

function resolveEpisodicMemory(ctx: unknown): EpisodicMemory | undefined {
  return (ctx as { nar?: NarWithEpisodes })?.nar?.getEpisodicMemory?.();
}

export const episodesCommands: CommandDefinition[] = [
  {
    name: '/episodes',
    aliases: ['.episodes'],
    description: 'Show recent episodes',
    usage: '/episodes [n]',
    execute: requiring('Episodic memory', resolveEpisodicMemory, async (em, args) => {
      const n = args[0] ? Number.parseInt(args[0], 10) : 10;
      const episodes = await em.getEpisodes({ limit: n });
      if (episodes.length === 0) return 'No episodes';
      return episodes
        .map((e, i) => `[${i + 1}] ${new Date(e.timestamp).toISOString()} ${e.type}: ${e.content}`)
        .join('\n');
    }),
  },
  {
    name: '/episode',
    aliases: ['.episode'],
    description: 'Show episode details by index',
    usage: '/episode <index>',
    execute: requiring('Episodic memory', resolveEpisodicMemory, async (em, args) => {
      const index = args[0];
      if (!index) return 'Usage: /episode <index>';
      const idx = Number.parseInt(index, 10);
      if (Number.isNaN(idx)) return 'Usage: /episode <index>';
      const episodes = await em.getEpisodes({ limit: idx + 1 });
      const episode = episodes.at(idx);
      if (!episode) return `Episode not found at index: ${idx}`;
      return JSON.stringify(episode, null, 2);
    }),
  },
  {
    name: '/forget',
    aliases: ['.forget'],
    description: 'Forget all episodes',
    usage: '/forget',
    execute: requiring('Episodic memory', resolveEpisodicMemory, async (em) => {
      await em.clear();
      return 'Forgot all episodes';
    }),
  },
];
