import { createHash } from 'node:crypto';
import type { Episode } from '@senars/util';
import type { NAR } from '../../nar.js';
import type { EpisodicMemory } from '../../memory/EpisodicMemory.js';
import { PriorityBag } from '../../bag/Bag.js';
import { AIKRProcessor, type ProcessOptions } from '../../learning/aikr-processor.js';
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
  /** Phase D (REFACTOR.todo2): admit mined candidates into this bounded bag instead of only returning them. */
  into?: MiningBag;
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

  if (options.into) {
    for (const negative of negatives) options.into.admit(negative);
  }
  return negatives;
}

/**
 * Phase D (REFACTOR.todo2): Hard-Negative Mining as an AIKR process — mined
 * candidates accumulate with priority = margin × recency × rubric relevance;
 * under budget the highest-signal candidates drain first (low-margin ones are
 * skipped), and decay forgets stale accumulation.
 */
const RUBRIC_RELEVANCE: Record<MinedNegative['rubric'], number> = {
  conflict: 1.0,
  groundedness: 0.8,
};

export interface HardNegativeCandidate {
  id: string;
  priority: number;
  negative: MinedNegative;
}

export interface MiningBagOptions {
  /** Bag capacity (AIKR bound; default 128). */
  capacity?: number;
  /** Pressure threshold below which draining is inert (default 0.5). */
  pressureThreshold?: number;
  /** Priority floor for decayed candidates (bag forgetRate). */
  forgetRate?: number;
  /** Candidates per drain (default 8). */
  budget?: number;
  /** Drop candidates below this margin at drain time (default 0 — keep all). */
  marginFloor?: number;
}

export class MiningBag {
  readonly #bag: PriorityBag<HardNegativeCandidate>;
  readonly #processor: AIKRProcessor<HardNegativeCandidate, MinedNegative>;
  readonly #budget: number;
  readonly #marginFloor: number;

  constructor(options: MiningBagOptions = {}) {
    this.#budget = options.budget ?? 8;
    this.#marginFloor = options.marginFloor ?? 0;
    this.#bag = new PriorityBag<HardNegativeCandidate>({
      capacity: options.capacity ?? 128,
      forgetRate: options.forgetRate,
    });
    this.#processor = new AIKRProcessor<HardNegativeCandidate, MinedNegative>({
      bag: this.#bag,
      pressureThreshold: options.pressureThreshold ?? 0.5,
      samplingStrategy: {
        name: 'greedy-priority',
        select: (items, budget) =>
          greedyCandidateSelection(items, budget, this.#marginFloor),
      },
      process: (picked) => picked.map((c) => c.negative),
    });
  }

  /** Admit a mined candidate: priority = margin × recency(1, decays) × rubric relevance. */
  admit(negative: MinedNegative): boolean {
    const margin = negative.margin ?? 0.5;
    return this.#bag.add({
      id: hardNegativeId(negative.text),
      priority: margin * (RUBRIC_RELEVANCE[negative.rubric] ?? 0.5),
      negative,
    });
  }

  /** Drain highest-signal candidates (margin × rubric weighted). */
  async drainIfPressured(options: ProcessOptions = {}): Promise<MinedNegative[]> {
    return this.#processor.processIfPressured({
      ...options,
      budget: options.budget ?? this.#budget,
    });
  }

  /** Explicit drain — ignores the pressure gate. */
  async drain(options: ProcessOptions = {}): Promise<MinedNegative[]> {
    return this.#processor.process({ ...options, budget: options.budget ?? this.#budget });
  }

  decay(rate?: number): void {
    this.#processor.decay(rate);
  }

  get pressure(): number {
    return this.#processor.pressure();
  }

  get size(): number {
    return this.#bag.size();
  }

  peek(): MinedNegative[] {
    return [...this.#bag.all()].map((c) => c.negative);
  }
}

/** Deterministic greedy selection over priority with margin floor. */
const greedyCandidateSelection = (
  items: HardNegativeCandidate[],
  budget: number,
  marginFloor: number
): HardNegativeCandidate[] =>
  items
    .filter((c) => (c.negative.margin ?? 0.5) >= marginFloor)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .slice(0, Math.max(budget, 0));

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
