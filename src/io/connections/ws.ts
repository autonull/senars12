import {WebSocket, WebSocketServer} from 'ws';
import type {ConnectionConfig, ConnectionDeps} from '../types.js';
import {BaseConnection} from './base.js';
import {createLogger} from '../../nar/logger/index.js';
import {startWSServer} from '../utils/http.js';

interface WSClient {
    ws: WebSocket;
    id: string;
    subscriptions: Set<string>;
    heartbeat: NodeJS.Timeout;
    lastSeen: number;
}

export class WSConnection extends BaseConnection {
    override readonly id: string;
    override readonly name: string;
    override readonly type = 'websocket';
    override readonly logger = createLogger({scope: 'io:ws'});
    private server: WebSocketServer | null = null;
    private clients = new Map<string, WSClient>();
    private eventSubscriptions = new Map<string, Set<WebSocket>>();
    private port: number;

    constructor(config: ConnectionConfig, deps: ConnectionDeps) {
        super(config, deps);
        this.id = config.id;
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
        if (this.state === 'disconnected' || this.state === 'idle') return;
        this.setState('disconnecting');

        for (const client of this.clients.values()) {
            clearInterval(client.heartbeat);
            client.ws.close(1000, reason ?? 'Server closing');
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
        if (client?.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({type: 'message', data: text, timestamp: Date.now()}));
        }
    }

    private broadcast(event: string, data?: Record<string, unknown>): void {
        const subscribers = this.eventSubscriptions.get(event);
        if (!subscribers) return;
        const message = JSON.stringify({type: 'event', event, data, timestamp: Date.now()});
        for (const ws of subscribers) {
            if (ws.readyState === WebSocket.OPEN) ws.send(message);
        }
    }

    private handleNewClient(ws: WebSocket): void {
        const id = crypto.randomUUID();
        const client: WSClient = {
            ws, id,
            subscriptions: new Set(),
            heartbeat: setInterval(() => this.sendHeartbeat(ws), 30000),
            lastSeen: Date.now(),
        };

        this.clients.set(id, client);
        this.logger.info(`WebSocket client ${id} connected. Total: ${this.clients.size}`);

        ws.on('message', data => {
            client.lastSeen = Date.now();
            try {
                this.handleWSMessage(ws, JSON.parse(data.toString()), client);
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

    private handleWSMessage(ws: WebSocket, message: Record<string, unknown>, client: WSClient): void {
        const msgType = message.type as string;

        if (msgType === 'subscribe') {
            for (const event of (message.events as string[]) ?? []) {
                if (!this.eventSubscriptions.has(event)) this.eventSubscriptions.set(event, new Set());
                this.eventSubscriptions.get(event)!.add(ws);
                client.subscriptions.add(event);
            }
            return;
        }

        if (msgType === 'unsubscribe') {
            for (const event of (message.events as string[]) ?? []) {
                this.eventSubscriptions.get(event)?.delete(ws);
                client.subscriptions.delete(event);
            }
            return;
        }

        this.handleMessage(this.createMessage(client.id, (message.data as string) ?? JSON.stringify(message), {clientId: client.id, type: msgType}));
    }

    private sendHeartbeat(ws: WebSocket): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({type: 'heartbeat', timestamp: Date.now()}));
        }
    }
}
