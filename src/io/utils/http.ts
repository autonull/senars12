import http, {type IncomingMessage} from 'http';
import type {WebSocketServer} from 'ws';
import type {Logger} from '../../nar/logger/index.js';

export interface ServerStartupOptions {
    port: number;
    timeout?: number;
    logger?: Logger;
    onListening?: () => void;
    onError?: (err: Error) => void;
}

export const parseHttpBody = (req: IncomingMessage): Promise<string> =>
    new Promise(resolve => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
        });
        req.on('end', () => resolve(body));
    });

export const setCORSHeaders = (res: http.ServerResponse): void => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
};

export const startHttpServer = (
    port: number,
    handler: (req: IncomingMessage, res: http.ServerResponse) => void,
    options?: { timeout?: number }
): Promise<http.Server> => {
    const server = http.createServer(handler);
    const timeout = options?.timeout ?? 10000;

    return new Promise((resolve, reject) => {
        const failTimeout = setTimeout(() => {
            reject(new Error('HTTP server startup timeout'));
            server.close();
        }, timeout);

        server.on('listening', () => {
            clearTimeout(failTimeout);
            resolve(server);
        });

        server.on('error', err => {
            if (server.listening) return;
            reject(err);
        });
    });
};

export const startWSServer = (
    port: number,
    WSServerClass: new (options: { port: number }) => WebSocketServer,
    options?: { timeout?: number }
): Promise<WebSocketServer> => {
    const server = new WSServerClass({port});
    const timeout = options?.timeout ?? 10000;

    return new Promise((resolve, reject) => {
        const failTimeout = setTimeout(() => {
            reject(new Error('WebSocket server startup timeout'));
            server.close();
        }, timeout);

        server.on('listening', () => {
            clearTimeout(failTimeout);
            resolve(server);
        });

        server.on('error', err => {
            if (server.address()) return;
            reject(err);
        });
    });
};

export class ApiKeyManager {
    private keys = new Set<string>();

    get size(): number {
        return this.keys.size;
    }

    add(key: string): void {
        this.keys.add(key);
    }

    remove(key: string): void {
        this.keys.delete(key);
    }

    has(key: string): boolean {
        return this.keys.has(key);
    }
}
