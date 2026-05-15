/**
 * WebSocket Adapter for Unified API Registry
 * Adapts WebSocket messages to registry handlers
 */

import {WebSocket, WebSocketServer} from 'ws';
import {BaseAdapter} from './base-adapter.js';

const CLIENT_ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';
const generateClientId = (): string =>
    Array.from({length: 16}, () => CLIENT_ID_CHARS[Math.floor(Math.random() * CLIENT_ID_CHARS.length)]).join('');

interface WSMessage {
    type: string;
    data?: Record<string, unknown>;
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

export class WebSocketAdapter extends BaseAdapter {
    private server: WebSocketServer | null = null;
    private clients: Map<string, WSClient> = new Map();
    private eventSubscriptions: Map<string, Set<WebSocket>> = new Map();
    private config: Required<WebSocketAdapterConfig>;

    constructor(registry?: any, config: WebSocketAdapterConfig = {}) {
        super('api:websocket');
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
                    this.logger.info(`WebSocket adapter listening on port ${this.config.port}`);
                    resolve();
                });

                this.server.on('error', (error) => {
                    this.logger.error('WebSocket adapter error', error);
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
                this.logger.info('WebSocket adapter closed');
                resolve();
            });
        });
    }

    getConnectedClients(): number {
        return this.clients.size;
    }

    broadcast(event: string, data: Record<string, unknown>): void {
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
        const id = generateClientId();
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
        this.logger.info(`Client ${id} connected. Total clients: ${this.clients.size}`);

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
            this.logger.info(`Client ${id} disconnected. Total clients: ${this.clients.size}`);
        });

        ws.on('error', (error) => {
            this.logger.error('WebSocket client error', error);
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
                this.logger.info(`Client ${id} idle timeout`);
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
                const events = (data as { events?: string[] })?.events ?? [];
                await this.handleSubscribe(ws, events);
                this.sendSuccess(ws, {subscribed: events}, message.id);
                return;
            }

            if (type === 'unsubscribe') {
                const events = (data as { events?: string[] })?.events ?? [];
                await this.handleUnsubscribe(ws, events);
                this.sendSuccess(ws, {unsubscribed: events}, message.id);
                return;
            }

            // Route to registry handler
            if (!this.registry.hasHandler(type)) {
                throw new Error(`Unknown message type: ${type}`);
            }

            const result = await this.registry.invoke(type, data ?? {}) as Record<string, unknown>;
            this.sendSuccess(ws, result, message.id);
        } catch (error: unknown) {
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

    private sendSuccess(ws: WebSocket, data: Record<string, unknown>, id?: string): void {
        this.sendJSON(ws, BaseAdapter.successResponse(data, id));
    }

    private sendError(ws: WebSocket, error: string, id?: string): void {
        this.sendJSON(ws, BaseAdapter.errorResponse('HANDLER_ERROR', error, id));
    }
}
