/**
 * Multi-agent cognitive cooperation (TODO13 Phase 4): agents delegate cognitive
 * tasks (LM rule executions) over WebSocket and exchange Narsese conclusions.
 * Agent B runs the same universal LM rule locally; Agent A admits the result
 * through its PerceptionGate with PEER_AGENT source quality and shadow-validates.
 */
import { makeId } from '@senars/util';

export interface CognitiveTaskDelegation {
  taskId: string;
  /** LM Rule ID (e.g. 'lm-hypothesis-generation'). */
  taskType: string;
  /** Serialized NAL state (premises/goal as Narsese). */
  narseseContext: string;
  /** WebSocket URL the delegator listens on for the result. */
  callbackEndpoint: string;
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
