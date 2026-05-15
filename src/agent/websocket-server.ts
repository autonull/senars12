/**
 * WebSocket Server - Refactored to use Unified API Registry
 * WebSocket API for SeNARS with adapter pattern
 */

import {Agent, Embodiment} from './Agent';
import {WebSocketAdapter} from '../api/index.js';

export interface WebSocketServerConfig {
    port?: number;
    maxClients?: number;
    heartbeatInterval?: number;
    idleTimeout?: number;
}

export class WebSocketServer implements Embodiment {
    readonly name = 'websocket';
    private adapter: WebSocketAdapter;
    private agent: Agent | null = null;

    constructor(config: WebSocketServerConfig = {}) {
        this.adapter = new WebSocketAdapter(undefined, {
            port: config.port ?? 8765,
            maxClients: config.maxClients ?? 100,
            heartbeatInterval: config.heartbeatInterval ?? 30000,
            idleTimeout: config.idleTimeout ?? 60000,
        });
    }

    async start(agent: Agent): Promise<void> {
        this.agent = agent;
        await this.adapter.start();
    }

    async stop(): Promise<void> {
        await this.adapter.stop();
    }

    async send(message: string): Promise<void> {
        this.adapter.broadcast('derivation', {message});
    }

    onMessage(_handler: (message: string) => void): void {
        // Handled by adapter through registry
    }

    public getConnectedClients(): number {
        return this.adapter.getConnectedClients();
    }
}

// Re-export for backward compatibility
export {WebSocketAdapter as WebSocketEmbodiment};
