/**
 * WebSocket Adapter for Unified API Registry
 * Adapts WebSocket messages to registry handlers
 */

import {WebSocket, WebSocketServer} from 'ws';
import {BaseAdapter, errorResponse, successResponse} from './base-adapter.js';
import {errMsg, makeId} from '../nar/utils/index.js';
import {
    createWSClient,
    cleanupWSClient,
    sendWSMessage,
    subscribeToEvents,
    unsubscribeFromEvents,
    broadcastToSubscribers,
    type WSClient,
} from '../io/utils/websocket.js';

interface WSMessage {
    type: string;
    data?: Record<string, unknown>;
    id?: string;
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
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

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

                this.heartbeatTimer = setInterval(() => this.checkHeartbeat(), this.config.heartbeatInterval);
            } catch (error) {
                reject(error);
            }
        });
    }

    async stop(): Promise<void> {
        return new Promise((resolve) => {
            if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
            if (!this.server) { resolve(); return; }

            for (const client of this.clients.values()) {
                cleanupWSClient(client);
            }
            this.clients.clear();
            this.eventSubscriptions.clear();

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
        broadcastToSubscribers(this.eventSubscriptions.get(event), event, data);
    }

    private handleConnection(ws: WebSocket): void {
        const client = createWSClient(ws, makeId(), {
            heartbeatInterval: this.config.heartbeatInterval,
            onMessage: (msg, cl) => {
                const wm = msg as unknown as WSMessage;
                this.handleMessage(ws, wm, cl).catch(error => {
                    this.sendError(ws, error.message, wm.id);
                });
            },
            onClose: (cl) => {
                this.clients.delete(cl.id);
                this.logger.info(`Client ${cl.id} disconnected. Total clients: ${this.clients.size}`);
            },
            onError: (error, cl) => {
                this.logger.error(`WebSocket client ${cl.id} error`, error);
                this.clients.delete(cl.id);
            },
        });

        this.clients.set(client.id, client);
        this.logger.info(`Client ${client.id} connected. Total clients: ${this.clients.size}`);
    }

    private checkHeartbeat(): void {
        const now = Date.now();
        for (const [id, client] of this.clients) {
            if (now - client.lastSeen > this.config.idleTimeout) {
                cleanupWSClient(client, 1000, 'Idle timeout');
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
            if (type === 'subscribe') {
                const events = (data as { events?: string[] })?.events ?? [];
                subscribeToEvents(this.eventSubscriptions, _client, events);
                this.sendSuccess(ws, {subscribed: events}, message.id);
                return;
            }

            if (type === 'unsubscribe') {
                const events = (data as { events?: string[] })?.events ?? [];
                unsubscribeFromEvents(this.eventSubscriptions, _client, events);
                this.sendSuccess(ws, {unsubscribed: events}, message.id);
                return;
            }

            if (!this.registry.hasHandler(type)) {
                throw new Error(`Unknown message type: ${type}`);
            }

            const result = await this.registry.invoke(type, data ?? {}) as Record<string, unknown>;
            this.sendSuccess(ws, result, message.id);
        } catch (error: unknown) {
            this.sendError(ws, errMsg(error), message.id);
        }
    }

    private sendSuccess(ws: WebSocket, data: Record<string, unknown>, id?: string): void {
        this.sendJSON(ws, successResponse(data, id));
    }

    private sendError(ws: WebSocket, error: string, id?: string): void {
        this.sendJSON(ws, errorResponse('HANDLER_ERROR', error, id));
    }
}
