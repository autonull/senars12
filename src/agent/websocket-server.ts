import {Agent, Embodiment} from './Agent';
import {WebSocket, WebSocketServer} from 'ws';
import {EventEmitter} from 'events';
import {createHash} from 'crypto';
import {NarService} from './services/NarService.js';
import type {Task} from '../nar/types.js';

interface WSMessage {
  type: string;
  data?: any;
  id?: string;
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
  private readonly port: number;
  private eventEmitter = new EventEmitter();
  private eventSubscriptions: Map<string, Set<WebSocket>> = new Map();
  private readonly port_to_nar: Map<number, NarService> = new Map();
  private narService: NarService | null = null;

  private readonly maxClients: number = 100;
  private readonly heartbeatInterval: number = 30000;
  private readonly idleTimeout: number = 60000;

  constructor(port: number = 8765) {
    this.port = port;
  }

  async start(agent: Agent): Promise<void> {
    this.agent = agent;
    const nar = agent.getNAR();
    this.narService = new NarService(nar);

    return new Promise((resolve, reject) => {
      try {
        this.server = new WebSocketServer({port: this.port});

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
    this.broadcast('derivation', {message});
  }

  onMessage(handler: (message: string) => void): void {
    this.eventEmitter.on('message', handler);
  }

  public getConnectedClients(): number {
    return this.clients.size;
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
        this.handleMessage(ws, message, client).catch((error) => {
          this.sendError(ws, error instanceof Error ? error.message : String(error), message.id);
        });
      } catch {
        this.sendError(ws, 'Invalid message format', undefined);
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

    ws.send(JSON.stringify({type: 'connected', id}));
  }

  private sendHeartbeat(ws: WebSocket): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({type: 'heartbeat', timestamp: Date.now()}));
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

  private async handleMessage(ws: WebSocket, message: WSMessage, client: WSClient): Promise<void> {
    if (!this.narService) {
      this.sendError(ws, 'Service not initialized', message.id);
      return;
    }

    const {type, data} = message;

    try {
      let result: any;
      switch (type) {
        case 'belief':
          result = await this.narService.addBelief(data.term, data.truth);
          break;
        case 'goal':
          result = await this.narService.addGoal(data.term, data.truth);
          break;
        case 'question':
          result = await this.narService.addQuestion(data.term);
          break;
        case 'concepts':
          result = await this.narService.getConcepts(data.filter, data.pagination);
          break;
        case 'run':
          result = await this.narService.run(data.steps);
          break;
        case 'query':
          result = await this.narService.query(data.term, data.filter);
          break;
        case 'stats':
          result = await this.narService.getStats();
          break;
        case 'config':
          result = data.key ? { [data.key]: this.narService.getConfig()[data.key] } : this.narService.getConfig();
          break;
        case 'attention':
          result = this.narService.getAttentionSnapshot();
          break;
        case 'history':
          result = { tasks: this.narService.getHistory(data.limit), count: this.narService.getHistory(data.limit).length };
          break;
        case 'subscribe':
          await this.handleSubscribe(ws, data.events);
          result = { subscribed: data.events };
          break;
        case 'unsubscribe':
          await this.handleUnsubscribe(ws, data.events);
          result = { unsubscribed: data.events };
          break;
        default:
          throw new Error(`Unknown message type: ${type}`);
      }

      this.sendSuccess(ws, result, message.id);
    } catch (error) {
      this.sendError(ws, error instanceof Error ? error.message : String(error), message.id);
    }
  }

  private async handleSubscribe(ws: WebSocket, events: string[]): Promise<void> {
    for (const event of events) {
      if (!this.eventSubscriptions.has(event)) {
        this.eventSubscriptions.set(event, new Set());
      }
      this.eventSubscriptions.get(event)!.add(ws);
    }
  }

  private async handleUnsubscribe(ws: WebSocket, events: string[]): Promise<void> {
    for (const event of events) {
      const subscribers = this.eventSubscriptions.get(event);
      if (subscribers) {
        subscribers.delete(ws);
      }
    }
  }

  private broadcast(event: string, data: any): void {
    const subscribers = this.eventSubscriptions.get(event);
    if (!subscribers || subscribers.size === 0) return;

    const message = JSON.stringify({ type: 'event', event, data, timestamp: Date.now() });
    const toRemove: WebSocket[] = [];

    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      } else {
        toRemove.push(ws);
      }
    }

    for (const ws of toRemove) {
      subscribers.delete(ws);
    }
  }

  private sendSuccess(ws: WebSocket, data: any, id?: string): void {
    ws.send(JSON.stringify({
      type: 'success',
      id,
      data,
      timestamp: Date.now()
    }));
  }

  private sendError(ws: WebSocket, error: string, id?: string): void {
    ws.send(JSON.stringify({
      type: 'error',
      id,
      error: {
        code: 'HANDLER_ERROR',
        message: error
      },
      timestamp: Date.now()
    }));
  }
}
