import http, {type Server as HTTPServer, type IncomingMessage, type ServerResponse} from 'http';
import {URL} from 'url';
import type {ConnectionConfig, ConnectionDeps, IOMessage} from '../types.js';
import {BaseConnection} from './base.js';
import {createLogger} from '../../nar/logger/index.js';

interface IncomingRequest {
    method: string;
    url: string;
    headers: Record<string, string | string[] | undefined>;
    body?: string;
}

export class HTTPConnection extends BaseConnection {
  override readonly id: string;
  override readonly name: string;
  override readonly type = 'http';

  private server: HTTPServer | null = null;
  private port: number;
  override readonly logger = createLogger({scope: 'io:http'});
  private apiKeys: Set<string> = new Set();

    constructor(config: ConnectionConfig, deps: ConnectionDeps) {
        super(config, deps);
        this.id = config.id;
        this.name = config.config.name as string ?? 'HTTP';
        this.port = (config.config.port as number) ?? 8080;
        const apiKey = config.config.apiKey as string;
        if (apiKey) {
            this.apiKeys.add(apiKey);
        }
    }

    override async connect(): Promise<void> {
        if (this.state === 'connected') return;
        this.setState('connecting');

        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => this.handleRequest(req, res));

            const failTimeout = setTimeout(() => {
                reject(new Error('HTTP server startup timeout'));
                this.server?.close();
            }, 10000);

            this.server.on('listening', () => {
                clearTimeout(failTimeout);
                this.setState('connected');
                this.logger.info(`HTTP server listening on port ${this.port}`);
                resolve();
            });

            this.server.on('error', (err) => {
                this.handleError(this.createError(err.message, 'HTTP_SERVER_ERROR', true, err));
                if (this.state !== 'connected') {
                    reject(err);
                }
            });
        });
    }

    override async disconnect(reason?: string): Promise<void> {
        if (this.state === 'disconnected' || this.state === 'idle') return;

        this.setState('disconnecting');

        return new Promise((resolve) => {
            this.server?.close(() => {
                this.setState('disconnected');
                this.logger.info(`HTTP server on port ${this.port} closed`);
                resolve();
            });
        });
    }

    async send(target: string, text: string): Promise<void> {
        // HTTP connection is server-side, send is typically not used directly
        // Responses go through the request/response cycle
        this.logger.warn(`send() called on HTTP connection - use respond via request context`);
    }

    private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const url = new URL(req.url || '/', `http://localhost:${this.port}`);
        const method = req.method || 'GET';

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

        if (method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
        }

        // Health endpoint (no auth required)
        if (url.pathname === '/health') {
            res.statusCode = 200;
            res.end(JSON.stringify({status: 'ok', timestamp: Date.now()}));
            return;
        }

        // Parse body for POST requests
        let body: Record<string, unknown> = {};
        if (method === 'POST') {
            const bodyStr = await this.parseBody(req);
            try {
                body = bodyStr ? JSON.parse(bodyStr) : {};
            } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({error: {code: 'INVALID_JSON', message: 'Invalid JSON body'}}));
                return;
            }
        }

        const authApiKey = req.headers['x-api-key'] as string;
        if (this.apiKeys.size > 0 && !this.apiKeys.has(authApiKey)) {
            res.statusCode = 401;
            res.end(JSON.stringify({error: {code: 'UNAUTHORIZED', message: 'Unauthorized'}}));
            return;
        }

        const ioMessage: IOMessage = {
            id: crypto.randomUUID(),
            source: this.id,
            sender: authApiKey ?? 'anonymous',
            text: method === 'GET' ? url.searchParams.toString() : JSON.stringify(body),
            timestamp: Date.now(),
            metadata: {
                method,
                path: url.pathname,
                query: Object.fromEntries(url.searchParams),
            },
        };

        const responsePromise = new Promise<string>((resolve) => {
            const originalHandler = this.messageHandler;
            this.messageHandler = async (msg: IOMessage): Promise<void> => {
                const response = JSON.stringify({
                    type: 'response',
                    data: msg.text,
                    timestamp: Date.now(),
                });
                res.statusCode = 200;
                res.end(response);
                this.messageHandler = originalHandler;
                resolve(msg.text);
            };
        });

        this.handleMessage(ioMessage);

        const timeout = setTimeout(() => {
            if (!res.writableEnded) {
                res.statusCode = 408;
                res.end(JSON.stringify({error: {code: 'TIMEOUT', message: 'Handler timeout'}}));
            }
        }, 30000);

        await responsePromise.catch(() => {});
        clearTimeout(timeout);
    }

    private parseBody(req: IncomingMessage): Promise<string> {
        return new Promise((resolve) => {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', () => resolve(body));
        });
    }

    addApiKey(key: string): void {
        this.apiKeys.add(key);
    }

    removeApiKey(key: string): void {
        this.apiKeys.delete(key);
    }
}