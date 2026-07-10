import type { CommandDefinition } from '@senars/core/command-types';
import type { EpisodicMemory } from '../memory/EpisodicMemory.js';

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
    execute: async (args, ctx) => {
      const em = resolveEpisodicMemory(ctx);
      if (!em) return 'Episodic memory not configured';
      const n = args[0] ? Number.parseInt(args[0]) : 10;
      const episodes = await em.getEpisodes({ limit: n });
      if (episodes.length === 0) return 'No episodes';
      return episodes
        .map((e, i) => `[${i + 1}] ${new Date(e.timestamp).toISOString()} ${e.type}: ${e.content}`)
        .join('\n');
    },
  },
  {
    name: '/episode',
    aliases: ['.episode'],
    description: 'Show episode details by index',
    usage: '/episode <index>',
    execute: async (args, ctx) => {
      const em = resolveEpisodicMemory(ctx);
      if (!em) return 'Episodic memory not configured';
      const index = args[0];
      if (!index) return 'Usage: /episode <index>';
      const idx = Number.parseInt(index);
      if (Number.isNaN(idx)) return 'Usage: /episode <index>';
      const episodes = await em.getEpisodes({ limit: idx + 1 });
      const episode = episodes.at(idx);
      if (!episode) return `Episode not found at index: ${idx}`;
      return JSON.stringify(episode, null, 2);
    },
  },
  {
    name: '/forget',
    aliases: ['.forget'],
    description: 'Forget all episodes',
    usage: '/forget',
    execute: async (_args, ctx) => {
      const em = resolveEpisodicMemory(ctx);
      if (!em) return 'Episodic memory not configured';
      await em.clear();
      return 'Forgot all episodes';
    },
  },
];
