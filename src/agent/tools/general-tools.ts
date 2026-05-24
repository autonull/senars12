import {tool} from 'ai';
import {z} from 'zod';
import type {EpisodicMemory} from '../../nar/memory/EpisodicMemory.js';

interface ToolDeps {
  nar?: NAR;
  episodicMemory?: EpisodicMemory;
}

interface NAR {
  queryTerm(term: unknown, filter?: unknown): {beliefs: unknown[]};
  getStatistics(): {totalConcepts: number; totalTasks: number};
  workingMemory: {size(): number};
}

export function generalTools(deps: ToolDeps) {
  return {
    search_memory: tool({
      description: 'Search NARS memory for beliefs matching a pattern',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        limit: z.number().optional().default(10),
      }),
      execute: async ({query, limit = 10}) => {
        if (!deps.nar) {
          return {error: 'NARS not available', results: []};
        }
        const results = deps.nar.queryTerm(query, {maxResults: limit});
        return {
          results: results.beliefs.slice(0, limit),
          count: results.beliefs.length,
        };
      },
    }),

    calculate: tool({
      description: 'Perform mathematical calculation',
      inputSchema: z.object({
        expression: z.string().describe('Math expression, e.g., "2 + 2 * 3"'),
      }),
      execute: async ({expression}) => {
        try {
          const sanitized = expression.replace(/[^0-9+\-*/(). ]/g, '');
          const result = Function(`"use strict";return (${sanitized})`)();
          return {
            expression,
            result,
            success: true,
          };
        } catch (error) {
          return {
            expression,
            error: String(error),
            success: false,
          };
        }
      },
    }),

    get_recent_episodes: tool({
      description: 'Get recent episodes from episodic memory',
      inputSchema: z.object({
        limit: z.number().optional().default(10),
        type: z.enum(['input', 'response', 'belief_added', 'question', 'tool_call', 'error']).optional(),
      }),
      execute: async ({limit = 10, type}) => {
        if (!deps.episodicMemory) {
          return {error: 'Episodic memory not available', episodes: []};
        }
        const episodes = await deps.episodicMemory.getEpisodes({limit, type});
        return {
          episodes,
          count: episodes.length,
        };
      },
    }),
  };
}