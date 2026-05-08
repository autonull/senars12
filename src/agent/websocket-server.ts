/**
 * WebSocket Server Embodiment
 * Real-time bidirectional communication with SeNARS
 */

import { Agent, Embodiment } from '../agent/Agent.js';
import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { createHash } from 'crypto';

interface WSMessage {
  type: 'belief' | 'goal' | 'question' | 'query' | 'subscribe' | 'unsubscribe';
  data: string;
  id?: string;
}

interface WSEvent {
  type: 'derivation' | 'belief_added' | 'goal_added' | 'question_added' | 'stats';
  data: unknown;
  timestamp: number;
}

interface WSClient {
  ws: WebSocket;
  id: string;
  subscriptions: Set<string>;
  heartbeat: NodeJS.Timeout;
  lastSeen: number;
}

export class WebSocketEmbodiment implements Embodiment {
  readonly name = 'websocket';
  private server: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private agent: Agent | null = null;
  private port: number;
  private eventEmitter = new EventEmitter();
  private globalSubscriptions: Set<string> = new Set();
  private maxClients: number = 100;
  private heartbeatInterval: number = 30000;
  private idleTimeout: number = 60000;

  constructor(port: number = 8765) {
    this.port = port;
  }

  async start(agent: Agent): Promise<void> {
    this.agent = agent;

    return new Promise((resolve, reject) => {
      try {
        this.server = new WebSocketServer({ port: this.port });

        this.server.on('listening', () => {
          console.log(`WebSocket server listening on port ${this.port}`);
          resolve();
        });

        this.server.on('error', (error) => {
          console.error('WebSocket server error:', error);
          reject(error);
        });

        this.server.on('connection', (ws) => {
          if (this.clients.size >= this.maxClients) {
            ws.close(1013, 'Server full');
            return;
          }
          this.handleConnection(ws);
        });

        setInterval(() => {
          this.checkHeartbeat();
        }, this.heartbeatInterval);
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

    for (const [, client] of this.clients) {
      client.ws.close();
    }
    this.clients.clear();

      this.server.close(() => {
        console.log('WebSocket server closed');
        resolve();
      });
    });
  }

  async send(message: string): Promise<void> {
    const event: WSEvent = {
      type: 'derivation',
      data: { message },
      timestamp: Date.now()
    };
    this.broadcastToClients(JSON.stringify(event));
  }

  onMessage(handler: (message: string) => void): void {
    this.eventEmitter.on('message', handler);
  }

  private handleConnection(ws: WebSocket): void {
    const id = createHash('sha256').update(Math.random().toString()).digest('hex').slice(0, 16);
    const client: WSClient = {
      ws,
      id,
      subscriptions: new Set(),
      heartbeat: setInterval(() => this.sendHeartbeat(ws), this.heartbeatInterval),
      lastSeen: Date.now()
    };

    this.clients.set(id, client);
    console.log(`Client ${id} connected. Total clients: ${this.clients.size}`);

    ws.on('message', (data) => {
      client.lastSeen = Date.now();
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        this.handleMessage(ws, message, client);
      } catch (error) {
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      clearInterval(client.heartbeat);
      this.clients.delete(id);
      console.log(`Client ${id} disconnected. Total clients: ${this.clients.size}`);
    });

    ws.on('error', (error) => {
      console.error('WebSocket client error:', error);
      clearInterval(client.heartbeat);
      this.clients.delete(id);
    });

    ws.send(JSON.stringify({ type: 'connected', id }));
  }

  private sendHeartbeat(ws: WebSocket): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
    }
  }

  private checkHeartbeat(): void {
    const now = Date.now();
    for (const [id, client] of this.clients) {
      if (now - client.lastSeen > this.idleTimeout) {
        client.ws.close(1000, 'Idle timeout');
        clearInterval(client.heartbeat);
        this.clients.delete(id);
        console.log(`Client ${id} idle timeout`);
      }
    }
  }

  private handleMessage(ws: WebSocket, message: WSMessage, client: WSClient): void {
    if (!this.agent) {
      this.sendError(ws, 'Agent not initialized');
      return;
    }

    switch (message.type) {
      case 'subscribe':
        this.globalSubscriptions.add(message.data);
        client.subscriptions.add(message.data);
        ws.send(JSON.stringify({ type: 'subscribed', data: message.data }));
        break;

      case 'unsubscribe':
        this.globalSubscriptions.delete(message.data);
        client.subscriptions.delete(message.data);
        ws.send(JSON.stringify({ type: 'unsubscribed', data: message.data }));
        break;

      case 'belief':
      case 'goal':
      case 'question':
        this.agent.handleInput(message.data)
          .then(response => {
            ws.send(JSON.stringify({ type: 'response', data: response, id: message.id }));
          })
          .catch(error => {
            this.sendError(ws, error instanceof Error ? error.message : String(error));
          });
        break;

      case 'query':
        this.handleQuery(ws, message.data);
        break;

      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  private async handleQuery(ws: WebSocket, termStr: string): Promise<void> {
    this.sendError(ws, 'Query not yet implemented');
  }

  private sendError(ws: WebSocket, error: string): void {
    ws.send(JSON.stringify({ type: 'error', data: error }));
  }

  private broadcastToClients(message: string): void {
    const data = JSON.parse(message);
    const shouldBroadcast = this.globalSubscriptions.size === 0 || this.globalSubscriptions.has(data.type);

    if (!shouldBroadcast) {
      return;
    }

    for (const [, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        const clientWantsEvent = client.subscriptions.size === 0 || client.subscriptions.has(data.type);
        if (clientWantsEvent) {
          client.ws.send(message);
        }
      }
    }
  }

  public getConnectedClients(): number {
    return this.clients.size;
  }

  public broadcastToSubscribers(event: WSEvent): void {
    const message = JSON.stringify(event);
    this.broadcastToClients(message);
  }

  public sendToClient(clientId: string, event: WSEvent): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(event));
    }
  }
}
