import type { Agent } from './Agent.js';
import type { CognitiveEvent } from './CognitiveEvent.js';
import type { ChatMessage } from './Protocol.js';

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

export type BridgeEvent = BridgeDelta | { type: 'chat.message'; message: ChatMessage; engine: string } | { type: string; [key: string]: unknown };

export class AgentBridge {
  readonly agent: Agent;
  #listeners = new Set<(event: BridgeEvent) => void>();

  constructor(agent: Agent) {
    this.agent = agent;
    agent.on('*', (event) => {
      const projected = this.#project(event);
      if (projected) this.#emit(projected);
    });
  }

  onEvent(handler: (event: BridgeEvent) => void): () => void {
    this.#listeners.add(handler);
    return () => this.#listeners.delete(handler);
  }

  projectFromMessage(msg: Record<string, unknown>): BridgeEvent | null {
    const type = msg.type as string | undefined;

    if (type === 'chat.user') {
      return {
        type: 'cognitive.delta',
        seqId: Date.now(),
        lens: 'belief',
        ops: [{
          action: 'add_node',
          id: `input-${Date.now()}`,
          data: {
            nodeType: 'nar:concept',
            term: msg.content as string,
            priority: 1.0,
            confidence: 1.0,
          },
        }],
      };
    }

    if (type === 'lens.set') {
      return {
        type: 'cognitive.delta',
        seqId: Date.now(),
        lens: msg.lens as string,
        ops: [],
      };
    }

    if (type === 'focus.set') {
      return {
        type: 'cognitive.delta',
        seqId: Date.now(),
        lens: 'belief',
        ops: [{
          action: 'add_node',
          id: `focus-${Date.now()}`,
          data: {
            nodeType: 'nar:concept',
            term: msg.term as string,
            priority: 1.0,
            confidence: 1.0,
          },
        }],
      };
    }

    return null;
  }

  #project(event: CognitiveEvent): BridgeEvent | null {
    if (event.type === 'derivation.made') {
      const conclusion = event.payload.conclusion;
      const nodeId = conclusion ? `derivation-${conclusion}` : `derivation-${Date.now()}`;
      return {
        type: 'cognitive.delta',
        seqId: Date.now(),
        lens: 'belief',
        ops: [{
          action: 'add_node',
          id: nodeId,
          data: {
            nodeType: 'metta:atom',
            atom: conclusion,
            term: conclusion,
            type: 'derivation',
            space: 'default',
          },
        }],
      };
    }
    if (event.type === 'input.user') {
      return {
        type: 'chat.message',
        engine: event.engine,
        message: {
          id: `msg-${Date.now()}`,
          role: 'user',
          content: event.payload.text,
          timestamp: event.timestamp,
          parentId: null,
          threadRootId: '',
          supports: [],
          contradicts: [],
          derivesFrom: [],
        },
      };
    }
    return null;
  }

  #emit(event: BridgeEvent): void {
    for (const listener of this.#listeners) {
      try { listener(event); } catch { /* ignore */ }
    }
  }
}
