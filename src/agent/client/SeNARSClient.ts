/**
 * SeNARS WebSocket Client
 * TypeScript client library for SeNARS WebSocket API
 */

import {createLogger, type Logger} from '../../nar/logger/index.js';

export interface WSMessage {
    type: string;
    data?: unknown;
    id?: string;
}

export interface WSResponse<T> {
    type: 'success' | 'error';
    id?: string;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
    timestamp?: number;
}

export interface WSEvent {
    type: 'event';
    event: string;
    data: unknown;
    timestamp: number;
}

export interface ConceptFilter {
    type?: 'belief' | 'goal' | 'question';
    term?: string;
}

export interface PaginationParams {
    limit?: number;
    offset?: number;
}

export class SeNARSClient {
    private ws: WebSocket | null = null;
    private messageId = 0;
    private pendingRequests: Map<string, {
        resolve: (data: unknown) => void;
        reject: (error: Error) => void;
    }> = new Map();
    private eventHandlers: Map<string, Set<(data: unknown) => void>> = new Map();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private readonly logger: Logger;

    constructor(private url: string = 'ws://localhost:8765') {
        this.logger = createLogger({scope: 'agent:senars-client'});
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                this.logger.info('Connected to SeNARS');
                this.reconnectAttempts = 0;
                resolve();
            };

            this.ws.onclose = (event) => {
                this.logger.info(`Disconnected from SeNARS (code: ${event.code})`);
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                this.logger.error('WebSocket error', new Error(error.message));
                reject(error);
            };

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data) as WSResponse<unknown> | WSEvent;

                if (message.type === 'success' || message.type === 'error') {
                    const pending = message.id ? this.pendingRequests.get(message.id) : null;
                    if (pending && message.id) {
                        this.pendingRequests.delete(message.id);
                        if (message.type === 'success' && message.data) {
                            pending.resolve(message.data);
                        } else if (message.type === 'error') {
                            pending.reject(new Error(message.error?.message || 'Unknown error'));
                        }
                    }
                } else if ('event' in message) {
                    const eventMsg = message as WSEvent;
                    const handlers = this.eventHandlers.get(eventMsg.event);
                    if (handlers) {
                        handlers.forEach(handler => handler(eventMsg.data));
                    }
                }
            };
        });
    }

    disconnect(): void {
        this.ws?.close();
        this.ws = null;
    }

    // Core operations
    async addBelief(term: string, truth?: { f: number; c: number }): Promise<{ added: true; term: string }> {
        return this.sendMessage('belief', {term, truth});
    }

    async addGoal(term: string, truth?: { f: number; c: number }): Promise<{ added: true; term: string }> {
        return this.sendMessage('goal', {term, truth});
    }

    async addQuestion(term: string): Promise<{ added: true; term: string }> {
        return this.sendMessage('question', {term});
    }

    async getConcepts(filter?: ConceptFilter, pagination?: PaginationParams): Promise<{
        results: unknown[];
        count: number
    }> {
        return this.sendMessage('concepts', {filter, pagination});
    }

    async run(steps?: number): Promise<{ derived: number }> {
        return this.sendMessage('run', {steps});
    }

    async query(term: string, filter?: Record<string, unknown>): Promise<{ results: unknown[]; count: number }> {
        return this.sendMessage('query', {term, filter});
    }

    async getStats(): Promise<{ totalConcepts: number; totalTasks: number; derivations: number; uptime: number }> {
        return this.sendMessage('stats');
    }

    async getConfig(key?: string): Promise<Record<string, unknown>> {
        return this.sendMessage('config', {key});
    }

    async getAttentionSnapshot(): Promise<{ concepts: Array<{ term: string; priority: number }>; total: number }> {
        return this.sendMessage('attention');
    }

    async getHistory(limit?: number): Promise<{ tasks: unknown[]; count: number }> {
        return this.sendMessage('history', {limit});
    }

    // Event subscription
    async subscribe(events: string[]): Promise<void> {
        await this.sendMessage('subscribe', {events});
    }

    async unsubscribe(events: string[]): Promise<void> {
        await this.sendMessage('unsubscribe', {events});
    }

    on(event: string, handler: (data: unknown) => void): void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event)!.add(handler);
    }

    off(event: string, handler: (data: unknown) => void): void {
        this.eventHandlers.get(event)?.delete(handler);
    }

    private attemptReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(() => this.connect(), delay);
    }

    private sendMessage<T>(type: string, data?: unknown): Promise<T> {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error('Not connected'));
                return;
            }

            const id = `req-${++this.messageId}`;
            this.pendingRequests.set(id, {resolve: resolve as (data: unknown) => void, reject});

            const message: WSMessage = {type, data, id};
            this.ws.send(JSON.stringify(message));
        });
    }
}
