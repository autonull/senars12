import type { WebSocket } from 'ws';
import type { IncomingFromServer, Lens, ConfigFieldType } from '@senars/core/protocol';
import type { CognitiveEventSource } from '@senars/core';

/** Shared shape of AgentBridge (and any bridge) for gateway compatibility. */
export interface BridgeLike {
  mount(source: CognitiveEventSource, sendFn: (msg: IncomingFromServer) => void): void;
  unmount(): void;
  sendInitialState(): void;
  sendLensList(): void;
  setLens(lens: Lens): void;
  setFocus(term: string | null): void;
  subscribeEvents(socket: WebSocket, currentLens: () => Lens): () => void;
  getConfigSchema(): Record<string, ConfigFieldType>;
  setConfig(key: string, value: unknown): void;
  setNodeTruth(id: string, truth: { frequency: number; confidence: number }): void;
  getRevisionHistory(term: string): Array<{
    truth: { frequency: number; confidence: number };
    stampId: string;
    timestamp: number;
    source: 'input' | 'derivation' | 'revision' | 'inference';
  }>;
  onNodeHistoryRequest(term: string): void;
  listConcepts(): Array<{
    term: string;
    priority: number;
    confidence: number;
    isContradiction?: boolean;
    getLinks(): Array<{ target: string; strength: number }>;
  }>;
  attentionReport(): { concepts: Array<{ term: string; priority: number }> };
  getDriveManager():
    | {
        getAllStates(): Array<{
          spec: { id: string; name: string };
          currentIntensity: number;
          isActive: boolean;
        }>;
      }
    | undefined;
  reset(): void;
  refreshView(): void;
  getSystemEventBus(): {
    on(event: string, handler: (...args: unknown[]) => void): () => void;
  };
}
