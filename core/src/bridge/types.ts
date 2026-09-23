import type { CognitiveEvent } from '../CognitiveEvent.js';
import type { ChatMessage } from '../protocol/index.js';

/** Structural event source satisfied by Agent (bridge must not import the agent it bridges). */
export interface AgentEventSource {
  on(event: string | '*', handler: (event: CognitiveEvent) => void): void;
}

/** Structural chat source satisfied by Agent (used by ChatStreamHandler). */
export interface ChatStreamAgent {
  chat?(text: string): AsyncIterable<{ kind: string; text?: string }>;
}

export interface BridgeDelta {
  type: 'cognitive.delta';
  seqId: number;
  lens: string;
  ops: Array<{
    action: string;
    id: string;
    data: Record<string, unknown>;
  }>;
}

export type BridgeEvent =
  | BridgeDelta
  | { type: 'chat.message'; message: ChatMessage; engine: string }
  | { type: string; [key: string]: unknown };
