import type { Agent, AgentCapabilities } from '@senars/core';
import type { GraphDelta } from '@senars/core';
import type { NarBackend } from '@senars/nar/backend';
import type { WebSocket } from 'ws';
import type { ConfigFieldType, IncomingFromServer, Lens } from '@senars/core/protocol';
import type { UnifiedGraphProjection } from './UnifiedGraphProjection.js';

/**
 * Thin adapter that presents a BridgeLike-compatible interface to the
 * gateway and socket handlers while delegating graph projection to
 * UnifiedGraphProjection and backend operations to the Agent / NarBackend.
 *
 * Graph deltas flow: backends produce GraphDelta → Agent pipes to handler →
 * UnifiedGraphProjection.applyDelta() → cognitive.delta to WebSocket clients.
 */
export class AgentBridge {
  #agent: Agent;
  #projection: UnifiedGraphProjection;
  #narBackend: NarBackend | null = null;
  #capabilities: AgentCapabilities | null = null;
  #sendFn: ((msg: IncomingFromServer) => void) | null = null;

  constructor(agent: Agent, projection: UnifiedGraphProjection) {
    this.#agent = agent;
    this.#projection = projection;
  }

  /** Register the NarBackend for NAR-specific features (history, drives, config). */
  setNarBackend(nb: NarBackend): void {
    this.#narBackend = nb;
  }

  // -- Graph projection delegation --

  mount(_source: unknown, sendFn: (msg: IncomingFromServer) => void): void {
    this.#sendFn = sendFn;
    this.#projection.mount(sendFn);
    this.#capabilities = this.#agent.capabilities()[0] ?? null;

    // Pipe backend graph deltas through the projection
    this.#agent.setGraphDeltaHandler((delta: GraphDelta) => {
      this.#projection.applyDelta(delta);
    });
  }

  unmount(): void {
    this.#agent.setGraphDeltaHandler(null);
    this.#projection.unmount();
    this.#sendFn = null;
  }

  sendInitialState(): void {
    this.#projection.sendInitialState();
    this.#sendFn?.({ type: 'config.schema', data: this.getConfigSchema() } as IncomingFromServer);
  }

  sendLensList(): void {
    this.#projection.sendLensList();
  }

  setLens(lens: Lens): void {
    this.#projection.setLens(lens);
  }

  setFocus(term: string | null): void {
    this.#projection.setFocus(term);
  }

  subscribeEvents(_socket: WebSocket, _currentLens: () => Lens): () => void {
    return () => {};
  }

  // -- NAR-specific operations (graceful degradation without NarBackend) --

  getConfigSchema(): Record<string, ConfigFieldType> {
    return {};
  }

  setConfig(key: string, value: unknown): void {
    this.#agent.submit(`config.set ${key} ${JSON.stringify(value)}`, crypto.randomUUID());
  }

  setNodeTruth(id: string, truth: { frequency: number; confidence: number }): void {
    if (this.#narBackend) {
      this.#agent.submit(`node.truth ${id} ${truth.frequency} ${truth.confidence}`, crypto.randomUUID());
    }
  }

  getRevisionHistory(_term: string): Array<{
    truth: { frequency: number; confidence: number };
    stampId: string;
    timestamp: number;
    source: 'input' | 'derivation' | 'revision' | 'inference';
  }> {
    return [];
  }

  onNodeHistoryRequest(term: string): void {
    const history = this.getRevisionHistory(term);
    this.#sendFn?.({ type: 'node.history', term, history } as IncomingFromServer);
  }

  listConcepts(): Array<{
    term: string;
    priority: number;
    confidence: number;
    isContradiction?: boolean;
    getLinks(): Array<{ target: string; strength: number }>;
  }> {
    return [];
  }

  attentionReport(): { concepts: Array<{ term: string; priority: number }> } {
    return { concepts: [] };
  }

  getDriveManager():
    | {
        getAllStates(): Array<{
          spec: { id: string; name: string };
          currentIntensity: number;
          isActive: boolean;
        }>;
      }
    | undefined {
    return undefined;
  }

  reset(): void {}

  refreshView(): void {}

  getSystemEventBus(): {
    on(_event: string, _handler: (...args: unknown[]) => void): () => void;
  } {
    return { on: () => () => {} };
  }
}
