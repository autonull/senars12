import type { ChatMessage } from '../Protocol.js';

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
