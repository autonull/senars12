import { HEAD_SPECS, specToQuery } from './head-specs.js';
import type {
  EmbeddingCache,
  EmbeddingPointer,
  EvaluateProposition,
  JudgmentManifold,
} from './types.js';
import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { DistillationLabel, JudgmentDataset } from './distill.js';

export type WakeDecision = 'wake' | 'not_yet' | 'unrelated';

export interface WakeVerdict {
  decision: WakeDecision;
  score?: number;
  abstained: boolean;
  /** Why the verdict was reached (user-input, relevance bands, fail-open paths). */
  reason: string;
}

export interface WakeGateOptions {
  manifold: JudgmentManifold;
  embeddingCache: EmbeddingCache;
  budget?: ReasoningBudget;
  /** relevance ≥ wakeThreshold ⇒ wake. */
  wakeThreshold?: number;
  /** wakeThreshold > relevance ≥ notYetThreshold ⇒ not_yet; below ⇒ unrelated. */
  notYetThreshold?: number;
  /** Hash-only label per judged sleep note when supplied. */
  dataset?: JudgmentDataset;
  source?: string;
}

const DEFAULT_BUDGET: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

const relevanceQuery = specToQuery(HEAD_SPECS.relevance);

/**
 * E5 wake gate (Jev wake pattern): before a timer/consolidation-driven wake,
 * judge the sleep note with the `relevance` head — one evaluate per note.
 * User input always wakes without a judgment. Unfitted/abstaining heads and
 * manifold failure fail open (`wake`) — timers waking is the pre-gate behavior,
 * so uncertainty must never stall a sleeping agent.
 */
export function createWakeGate(options: WakeGateOptions) {
  const {
    manifold,
    embeddingCache,
    budget = DEFAULT_BUDGET,
    wakeThreshold = 0.7,
    notYetThreshold = 0.4,
    dataset,
    source = 'wake-gate',
  } = options;

  return async (sleepNote: string, hint: { userInput?: boolean } = {}): Promise<WakeVerdict> => {
    if (hint.userInput) {
      return { decision: 'wake', abstained: false, reason: 'user-input' };
    }

    let pointer: EmbeddingPointer;
    try {
      pointer = (await embeddingCache.write(sleepNote)) as EmbeddingPointer;
      const [prop] = await manifold.judgeBatch(pointer, [relevanceQuery], budget);
      if (!prop || prop.kind !== 'evaluate') {
        return { decision: 'wake', abstained: true, reason: 'no-relevance-proposition' };
      }
      const relevance = prop as EvaluateProposition;
      if (prop.calibration.fitted !== true) {
        return { decision: 'wake', abstained: relevance.abstained, reason: 'unfitted' };
      }
      if (relevance.abstained) {
        return { decision: 'wake', abstained: true, reason: 'abstain' };
      }
      const decision: WakeDecision =
        relevance.score >= wakeThreshold
          ? 'wake'
          : relevance.score >= notYetThreshold
            ? 'not_yet'
            : 'unrelated';
      if (dataset) {
        const label: DistillationLabel = {
          evidenceId: `wake::${pointer}`,
          rubric: HEAD_SPECS.relevance.rubric,
          axis: HEAD_SPECS.relevance.axis,
          label: decision,
          score: relevance.score,
          source,
        };
        dataset.record(label);
      }
      return { decision, score: relevance.score, abstained: false, reason: 'relevance' };
    } catch {
      return { decision: 'wake', abstained: true, reason: 'manifold-unavailable' };
    }
  };
}
