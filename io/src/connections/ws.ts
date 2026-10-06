import { createLogger, makeId } from '@senars/util';
import { type WebSocket, WebSocketServer } from 'ws';
import { withDefaults } from '@senars/util/config';
import type { ConnectionConfig, ConnectionDeps } from '../types.js';
import { startWSServer } from '../utils/http.js';
import {
  broadcastToSubscribers,
  cleanupWSClient,
  createWSClient,
  sendWSMessage,
  subscribeToEvents,
  unsubscribeFromEvents,
  type WSClient,
} from '../utils/websocket.js';
import { BaseConnection } from './base.js';

interface WSOptions {
  name: string;
  port: number;
  greeting?: string;
}

/** What this transport does when configured with nothing at all. */
const WS_DEFAULTS: WSOptions = { name: 'WebSocket', port: 8765 };

export class WSConnection extends BaseConnection {
  override readonly type = 'websocket';
  override readonly logger = createLogger({ scope: 'io:ws' });
  private server: WebSocketServer | null = null;
  private clients = new Map<string, WSClient>();
  private eventSubscriptions = new Map<string, Set<WebSocket>>();
  private readonly port: number;
  private readonly greeting?: string;

  constructor(config: ConnectionConfig, deps: ConnectionDeps) {
    super(config, deps);
    const { name, port, greeting } = withDefaults<WSOptions>(config.config, WS_DEFAULTS);
    this.name = name;
    this.port = port;
    this.greeting = greeting;
  }

  override async connect(): Promise<void> {
    await this.runConnect('WS_SERVER_ERROR', async () => {
      this.server = await startWSServer(this.port, WebSocketServer);
      this.server.on('connection', (ws) => this.handleNewClient(ws));
    });
    this.logger.info(`WebSocket server listening on port ${this.port}`);
  }

  override async disconnect(reason?: string): Promise<void> {
    await this.runDisconnect(
      () =>
        new Promise<void>((resolve) => {
          for (const client of this.clients.values()) {
            cleanupWSClient(client, 1000, reason ?? 'Server closing');
          }
          this.clients.clear();
          this.server?.close(() => resolve());
        })
    );
    this.logger.info(`WebSocket server on port ${this.port} closed`);
  }

  async send(target: string, text: string): Promise<void> {
    if (target === 'broadcast') {
      this.broadcast(text);
      return;
    }
    const client = this.clients.get(target);
    if (client) {
      sendWSMessage(client.ws, 'message', { data: text });
    }
  }

  private broadcast = (event: string, data?: Record<string, unknown>): void =>
    broadcastToSubscribers(this.eventSubscriptions.get(event), event, data);

  private handleNewClient(ws: WebSocket): void {
    const id = makeId();
    const client = createWSClient(ws, id, {
      onMessage: (message) => this.handleWSMessage(message, client),
      onClose: (closed) => {
        this.dropClient(closed, id);
        this.logger.info(`WebSocket client ${id} disconnected. Total: ${this.clients.size}`);
      },
      onError: (err) => {
        this.logger.error(`WebSocket client ${id} error`, err);
        this.dropClient(client, id);
      },
    });

    this.clients.set(id, client);
    this.logger.info(`WebSocket client ${id} connected. Total: ${this.clients.size}`);
    if (this.greeting) sendWSMessage(ws, 'message', { data: this.greeting });
  }

  private dropClient(client: WSClient, id: string): void {
    unsubscribeFromEvents(this.eventSubscriptions, client, [...client.subscriptions]);
    this.clients.delete(id);
  }

  private handleWSMessage(message: Record<string, unknown>, client: WSClient): void {
    const msgType = message.type as string;

    if (msgType === 'subscribe') {
      subscribeToEvents(this.eventSubscriptions, client, (message.events as string[]) ?? []);
      return;
    }

    if (msgType === 'unsubscribe') {
      unsubscribeFromEvents(this.eventSubscriptions, client, (message.events as string[]) ?? []);
      return;
    }

    const incomingClientId = message.clientId ? String(message.clientId) : client.id;

    this.handleMessage(
      this.createMessage(client.id, (message.data as string) ?? JSON.stringify(message), {
        clientId: incomingClientId,
        type: msgType,
        channel: 'ws',
        origin: `ws:direct:${incomingClientId}`,
      })
    );
  }
}
