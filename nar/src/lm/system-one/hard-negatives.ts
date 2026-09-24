import { createHash } from 'node:crypto';
import type { Episode } from '@senars/util';
import type { NAR } from '../../nar.js';
import type { EpisodicMemory } from '../../memory/EpisodicMemory.js';
import { cosineF32 } from './contrastive.js';
import type { ContrastiveMemory } from './contrastive.js';
import type { EmbeddingCache } from './types.js';

export interface MinedNegative {
  /** Rubric the negative is hard for. */
  rubric: string;
  text: string;
  /** Provenance tag. */
  source: 'contradiction' | 'error-episode';
  /** 1 − max similarity to stored positives (bigger = more informative negative). */
  margin?: number;
}

export interface MineHardNegativesOptions {
  /** Max negatives per sweep (contradictions + errors combined). */
  limit?: number;
  /** Min absolute frequency gap for a contradiction pair to count. */
  conflictGap?: number;
}

/** Stable hash identity for mined negatives (joins the Z1 sidecar convention). */
export const hardNegativeId = (text: string): string =>
  createHash('sha256').update(`hard-neg::${text}`).digest('hex').slice(0, 16);

/**
 * Hard-negative mining (CLM) from existing SeNARS signals:
 * 1. NARS belief contradictions — same-term beliefs with divergent frequency.
 * 2. Episodic `error` episodes — failed tool calls / regressions.
 * Deterministic; reads only live NAR state + the episodic store.
 */
export async function mineHardNegatives(
  nar: NAR,
  episodic: EpisodicMemory | undefined,
  options: MineHardNegativesOptions = {}
): Promise<MinedNegative[]> {
  const limit = options.limit ?? 64;
  const conflictGap = options.conflictGap ?? 0.3;
  const negatives: MinedNegative[] = [];

  const byTerm = new Map<string, { f: number }[]>();
  for (const belief of nar.getBeliefs()) {
    if (!belief.truth) continue;
    const key = belief.term.toString();
    const list = byTerm.get(key) ?? [];
    list.push({ f: belief.truth.f });
    byTerm.set(key, list);
  }
  for (const [term, truths] of byTerm) {
    if (negatives.length >= limit / 2) break;
    let divergent = false;
    for (let i = 0; i < truths.length && !divergent; i++) {
      for (let j = i + 1; j < truths.length; j++) {
        if (Math.abs(truths[i]!.f - truths[j]!.f) > conflictGap) {
          divergent = true;
          break;
        }
      }
    }
    if (divergent) {
      negatives.push({ rubric: 'conflict', text: term, source: 'contradiction' });
    }
  }

  if (episodic) {
    try {
      const errors: Episode[] = await episodic.getEpisodes({
        type: 'error',
        limit: limit - negatives.length,
      });
      for (const episode of errors) {
        negatives.push({
          rubric: 'groundedness',
          text: episode.content,
          source: 'error-episode',
        });
      }
    } catch {
      // Episodic store unavailable — contradiction negatives only
    }
  }

  return negatives;
}

/**
 * Score margins against a ContrastiveMemory's stored positives and seed the
 * mined negatives under their rubrics. Returns exemplars actually stored.
 */
export async function seedContrastiveMemory(
  negatives: readonly MinedNegative[],
  memory: ContrastiveMemory,
  cache: EmbeddingCache
): Promise<number> {
  const byRubric = new Map<string, string[]>();
  for (const neg of negatives) {
    const list = byRubric.get(neg.rubric) ?? [];
    if (!list.includes(neg.text)) list.push(neg.text);
    byRubric.set(neg.rubric, list);
  }
  let added = 0;
  for (const [rubric, texts] of byRubric) {
    added += await memory.add(rubric, { negatives: texts }, cache);
  }
  return added;
}

/** Attach discrimination margins (1 − best positive cosine) to mined negatives. */
export async function withMargins(
  negatives: readonly MinedNegative[],
  memory: ContrastiveMemory,
  cache: EmbeddingCache
): Promise<MinedNegative[]> {
  const out: MinedNegative[] = [];
  for (const neg of negatives) {
    let margin: number | undefined;
    try {
      const pointer = await cache.write(neg.text);
      const embedding = cache.read(pointer);
      if (embedding) {
        const inDomain = memory.routingScore(embedding);
        margin = inDomain === undefined ? undefined : 1 - inDomain;
      }
    } catch {
      margin = undefined;
    }
    out.push({ ...neg, margin });
  }
  return out;
}
