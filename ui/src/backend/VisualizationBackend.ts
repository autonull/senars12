import { WebSocketServer } from 'ws';
import { WebSocket } from 'ws';
import type { EventLog } from '@senars/core/eventlog';
import type { ConfigView } from '@senars/core/config';
import type { Backend, BackendManifest } from '@senars/core/backend';
import type { CognitiveEvent } from '@senars/core/events';
import { Capability as Cap } from '@senars/core/capability';
import { projectGraph, projectChat } from '@senars/core/projections';

export class VisualizationBackend implements Backend {
  readonly id = 'visualization';
  readonly manifest: BackendManifest = {
    id: 'visualization',
    provides: new Set([Cap.GraphProjection, Cap.ChatRender, Cap.LensRender]),
    requires: new Set(),
    configSchema: { port: { type: 'number', default: 8765 } },
    eventTypes: new Set(['graph.op', 'chat.message', 'lens.set', 'focus.set']),
    handles: new Set(['*']),
  };

  #log!: EventLog;
  #wsServer: WebSocketServer | null = null;
  #clients: Map<WebSocket, { lens: string | null; focus: string | null }> = new Map();
  #lastEventId: string | null = null;

  async initialize(log: EventLog, config: ConfigView): Promise<void> {
    this.#log = log;

    await this.#fullSync();

    this.#processEvents();
  }

  #processEvents(): void {
    (async () => {
      for await (const event of this.#log.subscribe({ fromId: this.#lastEventId ?? undefined })) {
        this.#projectEvent(event);
        this.#lastEventId = event.id;
      }
    })();
  }

  async shutdown(): Promise<void> {
    this.#wsServer?.close();
    this.#wsServer = null;
  }

  async #fullSync(): Promise<void> {
    const events = await this.#log.getRange('0');
    for (const event of events) {
      this.#projectEvent(event);
      this.#lastEventId = event.id;
    }
  }

  #projectEvent(event: CognitiveEvent): void {
    const graphOps = projectGraph(event);
    if (graphOps.length > 0) {
      this.#broadcast({ type: 'cognitive.delta', ops: graphOps });
    }

    const chatMsg = projectChat(event);
    if (chatMsg) {
      this.#broadcast({ type: 'chat.message', message: chatMsg });
    }
  }

  #broadcast(msg: unknown): void {
    const data = JSON.stringify(msg);
    for (const [client] of this.#clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }
}