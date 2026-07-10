import type { CommandDefinition } from '@senars/core/command-types';
import type { EpisodicMemory } from '../memory/EpisodicMemory.js';

export const episodesCommands: CommandDefinition[] = [
  {
    name: '/episodes',
    aliases: ['.episodes'],
    description: 'Show recent episodes',
    usage: '/episodes [n]',
    execute: async (args, ctx) => {
      const nar = (ctx as any).nar as any;
      if (!nar) return 'NAR not configured';
      const em: EpisodicMemory | undefined = nar.getEpisodicMemory?.();
      if (!em) return 'Episodic memory not configured';
      const n = args[0] ? Number.parseInt(args[0]) : 10;
      const episodes = em.getRecent(n);
      if (episodes.length === 0) return 'No episodes';
      return episodes
        .map((e: any, i: number) => `[${i + 1}] ${e.timestamp?.toISOString?.() ?? e.timestamp}: ${e.summary ?? e.content}`)
        .join('\n');
    },
  },
  {
    name: '/episode',
    aliases: ['.episode'],
    description: 'Show episode details',
    usage: '/episode <id>',
    execute: async (args, ctx) => {
      const nar = (ctx as any).nar as any;
      if (!nar) return 'NAR not configured';
      const em: EpisodicMemory | undefined = nar.getEpisodicMemory?.();
      if (!em) return 'Episodic memory not configured';
      const id = args[0];
      if (!id) return 'Usage: /episode <id>';
      const episode = em.get(id);
      if (!episode) return `Episode not found: ${id}`;
      return JSON.stringify(episode, null, 2);
    },
  },
  {
    name: '/forget',
    aliases: ['.forget'],
    description: 'Forget an episode by id',
    usage: '/forget <id>',
    execute: async (args, ctx) => {
      const nar = (ctx as any).nar as any;
      if (!nar) return 'NAR not configured';
      const em: EpisodicMemory | undefined = nar.getEpisodicMemory?.();
      if (!em) return 'Episodic memory not configured';
      const id = args[0];
      if (!id) return 'Usage: /forget <id>';
      em.remove(id);
      return `Forgot episode: ${id}`;
    },
  },
];
