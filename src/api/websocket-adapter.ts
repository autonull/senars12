/**
 * WebSocket Adapter for Unified API Registry
 * Adapts WebSocket messages to registry handlers
 */

import {WebSocket, WebSocketServer} from 'ws';
import {APIRegistry} from './registry.js';
import {createHash} from 'crypto';

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

export interface WebSocketAdapterConfig {
    port?: number;
    maxClients?: number;
    heartbeatInterval?: number;
    idleTimeout?: number;
}

export class WebSocketAdapter {
    private registry: APIRegistry;
    private server: WebSocketServer | null = null;
    private clients: Map<string, WSClient> = new Map();
    private eventSubscriptions: Map<string, Set<WebSocket>> = new Map();
    private config: Required<WebSocketAdapterConfig>;

    constructor(registry?: APIRegistry, config: WebSocketAdapterConfig = {}) {
        this.registry = registry || APIRegistry.getInstance();
        this.config = {
            port: config.port ?? 8765,
            maxClients: config.maxClients ?? 100,
            heartbeatInterval: config.heartbeatInterval ?? 30000,
            idleTimeout: config.idleTimeout ?? 60000,
        };
    }

    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.server = new WebSocketServer({port: this.config.port});

                this.server.on('listening', () => {
                    console.log(`WebSocket adapter listening on port ${this.config.port}`);
                    resolve();
                });

                this.server.on('error', (error) => {
                    console.error('WebSocket adapter error:', error);
                    reject(error);
                });

                this.server.on('connection', (ws) => {
                    if (this.clients.size >= this.config.maxClients) {
                        ws.close(1013, 'Server full');
                        return;
                    }
                    this.handleConnection(ws);
                });

                // Heartbeat check
                setInterval(() => {
                    this.checkHeartbeat();
                }, this.config.heartbeatInterval);
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
                console.log('WebSocket adapter closed');
                resolve();
            });
        });
    }

    getConnectedClients(): number {
        return this.clients.size;
    }

    broadcast(event: string, data: any): void {
        const subscribers = this.eventSubscriptions.get(event);
        if (!subscribers || subscribers.size === 0) return;

        const message = JSON.stringify({
            type: 'event',
            event,
            data,
            timestamp: Date.now(),
        });
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

    private handleConnection(ws: WebSocket): void {
        const id = createHash('sha256')
            .update(Math.random().toString())
            .digest('hex')
            .slice(0, 16);
        const client: WSClient = {
            ws,
            id,
            subscriptions: new Set(),
            heartbeat: setInterval(
                () => this.sendHeartbeat(ws),
                this.config.heartbeatInterval
            ),
            lastSeen: Date.now(),
        };

        this.clients.set(id, client);
        console.log(`Client ${id} connected. Total clients: ${this.clients.size}`);

        ws.on('message', (data) => {
            client.lastSeen = Date.now();
            try {
                const message = JSON.parse(data.toString()) as WSMessage;
                this.handleMessage(ws, message, client).catch((error) => {
                    this.sendError(ws, error.message, message.id);
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
            ws.send(
                JSON.stringify({type: 'heartbeat', timestamp: Date.now()})
            );
        }
    }

    private checkHeartbeat(): void {
        const now = Date.now();
        for (const [id, client] of this.clients) {
            if (now - client.lastSeen > this.config.idleTimeout) {
                client.ws.close(1000, 'Idle timeout');
                clearInterval(client.heartbeat);
                this.clients.delete(id);
                console.log(`Client ${id} idle timeout`);
            }
        }
    }

    private async handleMessage(
        ws: WebSocket,
        message: WSMessage,
        _client: WSClient
    ): Promise<void> {
        const {type, data} = message;

        try {
            // Handle subscription commands locally
            if (type === 'subscribe') {
                await this.handleSubscribe(ws, data.events);
                this.sendSuccess(ws, {subscribed: data.events}, message.id);
                return;
            }

            if (type === 'unsubscribe') {
                await this.handleUnsubscribe(ws, data.events);
                this.sendSuccess(ws, {unsubscribed: data.events}, message.id);
                return;
            }

            // Route to registry handler
            if (!this.registry.hasHandler(type)) {
                throw new Error(`Unknown message type: ${type}`);
            }

            const result = await this.registry.invoke(type, data);
            this.sendSuccess(ws, result, message.id);
        } catch (error: any) {
            this.sendError(ws, error.message, message.id);
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

    private async handleUnsubscribe(
        ws: WebSocket,
        events: string[]
    ): Promise<void> {
        for (const event of events) {
            const subscribers = this.eventSubscriptions.get(event);
            if (subscribers) {
                subscribers.delete(ws);
            }
        }
    }

    private sendSuccess(ws: WebSocket, data: any, id?: string): void {
        ws.send(
            JSON.stringify({
                type: 'success',
                id,
                data,
                timestamp: Date.now(),
            })
        );
    }

    private sendError(ws: WebSocket, error: string, id?: string): void {
        ws.send(
            JSON.stringify({
                type: 'error',
                id,
                error: {
                    code: 'HANDLER_ERROR',
                    message: error,
                },
                timestamp: Date.now(),
            })
        );
    }
}
