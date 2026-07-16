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

export type BridgeEvent = BridgeDelta | { type: 'chat.message'; message: ChatMessage; engine: string };

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

  #project(event: CognitiveEvent): BridgeEvent | null {
    if (event.type === 'derivation') {
      return {
        type: 'cognitive.delta',
        seqId: Date.now(),
        lens: 'belief',
        ops: [{
          action: 'add_node',
          id: `derivation-${Date.now()}`,
          data: {
            nodeType: 'metta:atom',
            atom: event.term,
            type: 'derivation',
            space: 'default',
          },
        }],
      };
    }
    if (event.type === 'input') {
      return {
        type: 'chat.message',
        engine: event.engine,
        message: {
          id: `msg-${Date.now()}`,
          role: 'user',
          content: event.term,
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
