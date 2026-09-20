/**
 * Multi-agent cognitive cooperation (TODO13 Phase 4): agents delegate cognitive
 * tasks (LM rule executions) over WebSocket and exchange Narsese conclusions.
 * Agent B runs the same universal LM rule locally; Agent A admits the result
 * through its PerceptionGate with PEER_AGENT source quality and shadow-validates.
 */
import { makeId } from '@senars/util';
import type { JudgmentQuery } from '../lm/system-one/types.js';

export interface CognitiveTaskDelegation {
  taskId: string;
  /** LM Rule ID (e.g. 'lm-hypothesis-generation'), or 'judgment'. */
  taskType: string;
  /** Serialized NAL state (premises/goal as Narsese). */
  narseseContext: string;
  /** WebSocket URL the delegator listens on for the result. */
  callbackEndpoint: string;
  /** Present iff taskType === 'judgment' (TODO16 §10). */
  judgment?: {
    contextEmbedding: number[];
    queries: JudgmentQuery[];
  };
}

export interface CognitiveTaskResult {
  taskId: string;
  /** Narsese terms with truth values. */
  resultNarsese: string[];
  success: boolean;
}

export const createDelegation = (
  taskType: string,
  narseseContext: string,
  callbackEndpoint: string
): CognitiveTaskDelegation => ({
  taskId: makeId(),
  taskType,
  narseseContext,
  callbackEndpoint,
});

export interface DelegationPeer {
  /** Execute a delegated cognitive task with the local (universal) LM rule. */
  executeTask(delegation: CognitiveTaskDelegation): Promise<CognitiveTaskResult>;
}

/** Server side: handle an incoming delegation message over a WebSocket. */
export const handleDelegationMessage = async (
  peer: DelegationPeer,
  raw: string,
  reply: (result: CognitiveTaskResult) => void
): Promise<void> => {
  try {
    const msg = JSON.parse(raw) as { type?: string; delegation?: CognitiveTaskDelegation };
    if (msg.type !== 'cognitive-delegation' || !msg.delegation) return;
    reply(await peer.executeTask(msg.delegation));
  } catch {
    /* malformed message: ignore */
  }
};

// ─── Judgment delegation (TODO16 §10) ───────────────────────────────────────

import type { EmbeddingPointer, JudgmentManifold, JudgmentProposition, ReasoningBudget } from '../lm/system-one/types.js';

export interface JudgmentDelegationResult {
  taskId: string;
  propositions: JudgmentProposition[];
  /** Receiver must re-enter these at PEER_AGENT quality (mirrors Narsese path). */
  sourceQuality: 'PEER_AGENT';
  success: boolean;
}

export const createJudgmentDelegation = (
  contextEmbedding: readonly number[],
  queries: readonly JudgmentQuery[],
  callbackEndpoint: string
): CognitiveTaskDelegation => ({
  taskId: makeId(),
  taskType: 'judgment',
  narseseContext: '',
  callbackEndpoint,
  judgment: { contextEmbedding: [...contextEmbedding], queries: [...queries] },
});

/** Peer side: executes judgment batches with the local manifold. */
export class JudgmentDelegationPeer implements DelegationPeer {
  #manifold: JudgmentManifold;
  #budget: ReasoningBudget;
  #cache?: { writeRaw(embedding: readonly number[]): Promise<EmbeddingPointer> };

  constructor(
    manifold: JudgmentManifold,
    budget: ReasoningBudget,
    cache?: { writeRaw(embedding: readonly number[]): Promise<EmbeddingPointer> }
  ) {
    this.#manifold = manifold;
    this.#budget = budget;
    this.#cache = cache;
  }

  async executeTask(delegation: CognitiveTaskDelegation): Promise<CognitiveTaskResult> {
    const result = await this.executeJudgment(delegation);
    return { taskId: delegation.taskId, resultNarsese: [], success: result.success };
  }

  /** Full round-trip used by tests and direct transport wiring. */
  async executeJudgment(delegation: CognitiveTaskDelegation): Promise<JudgmentDelegationResult> {
    if (delegation.taskType !== 'judgment' || !delegation.judgment) {
      return { taskId: delegation.taskId, propositions: [], sourceQuality: 'PEER_AGENT', success: false };
    }
    try {
      const pointer = this.#cache
        ? await this.#cache.writeRaw(delegation.judgment.contextEmbedding)
        : (0 as EmbeddingPointer);
      const propositions = await this.#manifold.judgeBatch(
        pointer,
        delegation.judgment.queries,
        this.#budget
      );
      return { taskId: delegation.taskId, propositions, sourceQuality: 'PEER_AGENT', success: true };
    } catch {
      return { taskId: delegation.taskId, propositions: [], sourceQuality: 'PEER_AGENT', success: false };
    }
  }
}
