import type {CommandDefinition} from './registry.js';
import type {EpisodicMemory} from '../../nar/memory/EpisodicMemory.js';

interface ExtendedNAR {
  episodicMemory?: EpisodicMemory;
}

export const episodesCommands: CommandDefinition[] = [
  {
    name: '/episodes',
    aliases: ['.episodes'],
    description: 'View episodic memory entries',
    usage: '/episodes [n] - Show last n entries (default: 10)',
    execute: async (args, ctx) => {
      const nar = ctx.nar as ExtendedNAR;
      if (!nar.episodicMemory) {
        return 'EpisodicMemory not available';
      }

      const limit = args.length > 0 ? parseInt(args[0]!, 10) : 10;
      if (isNaN(limit) || limit < 1) {
        return 'Invalid limit: use a positive number';
      }

      try {
        const episodes = await nar.episodicMemory.getEpisodes({limit});
        
        if (episodes.length === 0) {
          return 'No episodes found';
        }

        let result = `Episodic Memory (${episodes.length} entries):\n`;
        for (const episode of episodes) {
          const time = new Date(episode.timestamp).toISOString();
          result += `[${time}] ${episode.type}: ${episode.content}\n`;
          if (Object.keys(episode.metadata).length > 0) {
            result += `  Metadata: ${JSON.stringify(episode.metadata)}\n`;
          }
        }
        return result.trim();
      } catch (error) {
        return `Error retrieving episodes: ${error}`;
      }
    }
  },
  {
    name: '/episodes.clear',
    aliases: ['.episodes.clear'],
    description: 'Clear all episodic memory',
    usage: '/episodes.clear',
    execute: async (_args, ctx) => {
      const nar = ctx.nar as ExtendedNAR;
      if (!nar.episodicMemory) {
        return 'EpisodicMemory not available';
      }

      try {
        await nar.episodicMemory.clear();
        return 'Episodic memory cleared';
      } catch (error) {
        return `Error clearing episodes: ${error}`;
      }
    }
  },
  {
    name: '/episodes.prune',
    aliases: ['.episodes.prune'],
    description: 'Remove old episodes based on retention policy',
    usage: '/episodes.prune',
    execute: async (_args, ctx) => {
      const nar = ctx.nar as ExtendedNAR;
      if (!nar.episodicMemory) {
        return 'EpisodicMemory not available';
      }

      try {
        await nar.episodicMemory.pruneOldEpisodes();
        return 'Old episodes pruned';
      } catch (error) {
        return `Error pruning episodes: ${error}`;
      }
    }
  }
];
