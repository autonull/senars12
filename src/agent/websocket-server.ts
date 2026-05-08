/**
 * WebSocket Server Embodiment
 * Real-time bidirectional communication with SeNARS
 */

import { Agent, Embodiment } from '../agent/Agent.js';
import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

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

export class WebSocketEmbodiment implements Embodiment {
  readonly name = 'websocket';
  private server: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private agent: Agent | null = null;
  private port: number;
  private eventEmitter = new EventEmitter();
  private subscribedTypes: Set<string> = new Set();

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
          this.handleConnection(ws);
        });
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

      for (const client of this.clients) {
        client.close();
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
    this.clients.add(ws);
    console.log(`Client connected. Total clients: ${this.clients.size}`);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        this.handleMessage(ws, message);
      } catch (error) {
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      console.log(`Client disconnected. Total clients: ${this.clients.size}`);
    });

    ws.on('error', (error) => {
      console.error('WebSocket client error:', error);
      this.clients.delete(ws);
    });
  }

  private handleMessage(ws: WebSocket, message: WSMessage): void {
    if (!this.agent) {
      this.sendError(ws, 'Agent not initialized');
      return;
    }

    switch (message.type) {
      case 'subscribe':
        this.subscribedTypes.add(message.data);
        ws.send(JSON.stringify({ type: 'subscribed', data: message.data }));
        break;

      case 'unsubscribe':
        this.subscribedTypes.delete(message.data);
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
    if (this.subscribedTypes.size > 0 && !this.subscribedTypes.has(data.type)) {
      return;
    }

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  public getConnectedClients(): number {
    return this.clients.size;
  }
}
