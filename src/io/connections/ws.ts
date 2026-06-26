import {WebSocket, WebSocketServer} from 'ws';
import type {ConnectionConfig, ConnectionDeps} from '../types.js';
import {BaseConnection} from './base.js';
import {createLogger} from '../../nar/logger';
import {startWSServer} from '../utils/http.js';
import {makeId} from '../../nar/utils';
import {
    broadcastToSubscribers,
    cleanupWSClient,
    sendHeartbeat,
    sendWSMessage,
    subscribeToEvents,
    unsubscribeFromEvents,
    type WSClient
} from '../utils/websocket.js';

export class WSConnection extends BaseConnection {
    override readonly type = 'websocket';
    override readonly logger = createLogger({scope: 'io:ws'});
    private server: WebSocketServer | null = null;
    private clients = new Map<string, WSClient>();
    private eventSubscriptions = new Map<string, Set<WebSocket>>();
    private port: number;

    constructor(config: ConnectionConfig, deps: ConnectionDeps) {
        super(config, deps);
        this.name = config.config.name as string ?? 'WebSocket';
        this.port = (config.config.port as number) ?? 8765;
    }

    override async connect(): Promise<void> {
        if (this.state === 'connected') return;
        this.setState('connecting');

        try {
            this.server = await startWSServer(this.port, WebSocketServer);
            this.server.on('connection', ws => this.handleNewClient(ws));
            this.setState('connected');
            this.logger.info(`WebSocket server listening on port ${this.port}`);
        } catch (err) {
            this.handleError(this.createError((err as Error).message, 'WS_SERVER_ERROR', true, err as Error));
            throw err;
        }
    }

    override async disconnect(reason?: string): Promise<void> {
        if (this.isDisconnected()) return;
        this.setState('disconnecting');

        for (const client of this.clients.values()) {
            cleanupWSClient(client, 1000, reason ?? 'Server closing');
        }
        this.clients.clear();

        return new Promise(resolve => {
            this.server?.close(() => {
                this.setState('disconnected');
                this.logger.info(`WebSocket server on port ${this.port} closed`);
                resolve();
            });
        });
    }

    async send(target: string, text: string): Promise<void> {
        if (target === 'broadcast') {
            this.broadcast(text);
            return;
        }
        const client = this.clients.get(target);
        if (client) {
            sendWSMessage(client.ws, 'message', {data: text});
        }
    }

    private broadcast = (event: string, data?: Record<string, unknown>): void =>
        broadcastToSubscribers(this.eventSubscriptions.get(event), event, data);

    private handleNewClient(ws: WebSocket): void {
        const id = makeId();
        const client: WSClient = {
            ws, id,
            subscriptions: new Set(),
            heartbeat: setInterval(() => sendHeartbeat(ws), 30000),
            lastSeen: Date.now(),
        };

        this.clients.set(id, client);
        this.logger.info(`WebSocket client ${id} connected. Total: ${this.clients.size}`);

        ws.on('message', data => {
            client.lastSeen = Date.now();
            try {
                this.handleWSMessage(JSON.parse(data.toString()), client);
            } catch (e) {
                this.logger.error('Invalid WebSocket message', e as Error);
            }
        });

        ws.on('close', () => {
            clearInterval(client.heartbeat);
            this.clients.delete(id);
            this.logger.info(`WebSocket client ${id} disconnected. Total: ${this.clients.size}`);
        });

        ws.on('error', err => {
            this.logger.error(`WebSocket client ${id} error`, err);
            clearInterval(client.heartbeat);
            this.clients.delete(id);
        });

        ws.send(JSON.stringify({type: 'connected', id}));
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

        // Optional tracking of clientId to ensure persistent memory cache hits across reconnections
        const incomingClientId = message.clientId ? String(message.clientId) : client.id;

        this.handleMessage(this.createMessage(client.id, (message.data as string) ?? JSON.stringify(message), {
            clientId: incomingClientId,
            type: msgType,
            channel: 'ws',
            origin: `ws:direct:${incomingClientId}`
        }));
    }
}
