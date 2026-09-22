import { tool } from 'ai';
import { z } from 'zod';
import type { EpisodicMemory } from '../../memory/EpisodicMemory.js';
import type { EmbeddingGenerator } from '../../memory/embedding.js';
import { cosineSimilarity, createEmbeddingGenerator } from '../../memory/embedding.js';

// --- rag_query ---

export interface RagQueryDeps {
  episodicMemory?: EpisodicMemory;
  embeddingGenerator?: EmbeddingGenerator;
  topK?: number;
}

export function createRagQueryTools(deps: RagQueryDeps) {
  const embedder = deps.embeddingGenerator ?? createEmbeddingGenerator();
  const topK = deps.topK ?? 5;

  return {
    rag_query: tool({
      description:
        'Semantic search over episodic memory. Embeds the query and returns the most relevant past episodes by meaning, not just keywords.',
      inputSchema: z.strictObject({
        query: z.string().describe('The search query for semantic matching'),
        limit: z.number().min(1).max(20).optional().default(topK).describe('Number of results'),
        typeFilter: z
          .enum(['input', 'response', 'belief_added', 'question', 'tool_call', 'error'])
          .optional()
          .describe('Optional episode type filter'),
      }),
      execute: async ({ query, limit = topK, typeFilter }) => {
        if (!deps.episodicMemory) {
          return { error: 'Episodic memory not available', results: [] };
        }
        try {
          const episodes = await deps.episodicMemory.getEpisodes({
            limit: 500,
            ...(typeFilter ? { type: typeFilter } : {}),
          });
          if (episodes.length === 0) {
            return { results: [], count: 0 };
          }
          const queryEmbedding = await embedder.generate(query);
          const scored: Array<{
            episode: { timestamp: number; type: string; content: string };
            score: number;
          }> = [];
          for (const ep of episodes) {
            const text = `${ep.content} ${Object.values(ep.metadata ?? {}).join(' ')}`;
            const emb = await embedder.generate(text);
            const score = cosineSimilarity(queryEmbedding, emb);
            if (score > 0.05) {
              scored.push({
                episode: { timestamp: ep.timestamp, type: ep.type, content: ep.content },
                score,
              });
            }
          }

          scored.sort((a, b) => b.score - a.score);
          const top = scored.slice(0, limit);
          return {
            results: top.map((r) => ({ ...r.episode, score: r.score })),
            count: top.length,
            totalScored: scored.length,
          };
        } catch (error) {
          return { error: String(error), results: [] };
        }
      },
    }),
  };
}
