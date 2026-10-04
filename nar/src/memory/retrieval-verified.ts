import type { Episode, EpisodeType } from '@senars/util';
import { parseJsonOr } from '@senars/util';
import type { TextGenerator } from '../ports';
import type { EpisodicMemory } from './EpisodicMemory.js';
import type { EmbeddingGenerator } from './embedding.js';
import { cosineUnit, l2Normalize } from '../utils/similarity.js';

export interface ConsolidationOptions {
  /** Episodes considered per consolidation pass. */
  limit?: number;
  /** Minimum LM-assigned relevance (0..1) for promotion. */
  relevanceThreshold?: number;
  /** Cosine similarity above which a candidate is considered a duplicate. */
  dedupeThreshold?: number;
  /** Only episodes of this type are considered. */
  type?: EpisodeType;
}

/**
 * What one retrieval-verified pass promoted. Named for what it reports: the
 * consolidator's own `ConsolidationResult` is a summary episode plus the ids merged
 * into it, and two results with one name in the same package meant a caller holding
 * one could not say which it had.
 */
export interface PromotionResult {
  considered: number;
  relevant: number;
  promoted: Array<{ content: string; provenance: Record<string, unknown> }>;
  deduped: number;
}

export interface ConsolidatorDeps {
  episodic: EpisodicMemory;
  lm: TextGenerator;
  embeddings: EmbeddingGenerator;
  /** Promote a verified belief to long-term storage. */
  promote: (content: string, provenance: Record<string, unknown>) => Promise<void> | void;
}

const DEFAULTS = { limit: 50, relevanceThreshold: 0.5, dedupeThreshold: 0.9 };

const extractRelevance = (reply: string, count: number): number[] => {
  const match = /\[[\s\S]*\]/.exec(reply);
  if (!match) return [];
  const parsed = parseJsonOr<unknown[]>(match[0], []);
  return parsed.slice(0, count).map((v) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : 0));
};

/**
 * Retrieval-verified long-term memory consolidation:
 * store → episodic recall → LM relevance filter (structured tier) →
 * embedding-similarity dedupe → promotion of durable semantic beliefs.
 * Provenance (episode timestamps) is logged on every promotion.
 */
export const consolidateEpisodes = async (
  deps: ConsolidatorDeps,
  options?: Partial<ConsolidationOptions>
): Promise<PromotionResult> => {
  const { limit = 50, relevanceThreshold = 0.5, dedupeThreshold = 0.9, type } = options ?? {};
  const episodes = await deps.episodic.getEpisodes({ limit, type });
  if (episodes.length === 0) {
    return { considered: 0, relevant: 0, promoted: [], deduped: 0 };
  }

  const reply = await deps.lm.generateText(
    [
      'Rate the durable-knowledge relevance of each conversation entry for long-term memory.',
      'Return ONLY a JSON array of relevance scores (0..1), one per entry, in order.',
      '',
      ...episodes.map((e, i) => `[${i}] ${e.content}`),
    ].join('\n'),
    { task: 'structured' }
  );
  const relevances = extractRelevance(reply, episodes.length);

  const candidates = episodes
    .map((e, i) => ({ episode: e, relevance: relevances[i] ?? 0 }))
    .filter((c) => c.relevance >= relevanceThreshold);

  const promoted: PromotionResult['promoted'] = [];
  const keptUnits: number[][] = [];
  let deduped = 0;

  for (const c of candidates) {
    const content = c.episode.content;
    // Unit-length once per candidate, so the pairwise scan is a dot product
    // rather than a fresh norm pass on both sides of every comparison.
    const unit = l2Normalize(await deps.embeddings.generate(content));
    const duplicate = keptUnits.some((v) => cosineUnit(unit, v) >= dedupeThreshold);
    if (duplicate) {
      deduped++;
      continue;
    }
    keptUnits.push(unit);
    const provenance = {
      source: 'episodic',
      timestamps: [c.episode.timestamp],
      type: c.episode.type,
    };
    await deps.promote(content, provenance);
    promoted.push({ content, provenance });
  }

  return { considered: episodes.length, relevant: candidates.length, promoted, deduped };
};
