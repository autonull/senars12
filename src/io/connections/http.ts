import http, {type IncomingMessage, type ServerResponse} from 'http';
import {URL} from 'url';
import {createLogger} from '../../../nar/src/logger';
import {makeId} from '../../../nar/src/utils';
import type {ConnectionConfig, ConnectionDeps} from '../types.js';
import {ApiKeyManager, parseHttpBody, setCORSHeaders, startHttpServer} from '../utils/http.js';
import {BaseConnection} from './base.js';

export class HTTPConnection extends BaseConnection {
    override readonly type = 'http';
    override readonly logger = createLogger({scope: 'io:http'});
    private server: http.Server | null = null;
    private readonly port: number;
    private apiKeys = new ApiKeyManager();
    private pendingRequests = new Map<string, (text: string) => void>();

    constructor(config: ConnectionConfig, deps: ConnectionDeps) {
        super(config, deps);
        this.name = (config.config.name as string) ?? 'HTTP';
        this.port = (config.config.port as number) ?? 8080;
        const apiKey = config.config.apiKey as string;
        if (apiKey) this.apiKeys.add(apiKey);
    }

    override async connect(): Promise<void> {
        if (this.state === 'connected') return;
        this.setState('connecting');

        try {
            this.server = await startHttpServer(this.port, (req, res) => this.handleRequest(req, res));
            this.setState('connected');
            this.logger.info(`HTTP server listening on port ${this.port}`);
        } catch (err) {
            this.handleError(
                this.createError((err as Error).message, 'HTTP_SERVER_ERROR', true, err as Error)
            );
            throw err;
        }
    }

    override async disconnect(): Promise<void> {
        if (this.isDisconnected()) return;
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
        const resolve = this.pendingRequests.get(target);
        if (resolve) {
            resolve(text);
            this.pendingRequests.delete(target);
        } else {
            this.logger.warn(`send() called on HTTP connection for unknown target: ${target}`);
        }
    }

    addApiKey = (key: string): void => this.apiKeys.add(key);

    removeApiKey = (key: string): void => this.apiKeys.remove(key);

    private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const url = new URL(req.url || '/', `http://localhost:${this.port}`);
        const method = req.method || 'GET';

        res.setHeader('Content-Type', 'application/json');
        setCORSHeaders(res);

        if (method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
        }

        if (url.pathname === '/health') {
            res.statusCode = 200;
            res.end(JSON.stringify({status: 'ok', timestamp: Date.now()}));
            return;
        }

        let body: Record<string, unknown> = {};
        if (method === 'POST') {
            const bodyStr = await parseHttpBody(req);
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

        // Ensure the ID of the HTTP request is used as the target for resolution
        const requestId = makeId();

        // The target to respond to will be the requestId
        const ioMessage = this.createMessage(
            requestId,
            method === 'GET' ? url.searchParams.toString() : JSON.stringify(body),
            {
                method,
                path: url.pathname,
                query: Object.fromEntries(url.searchParams),
                channel: 'http',
                origin: `http:direct:${requestId}`,
            }
        );

        const responsePromise = new Promise<string>((resolve) => {
            this.pendingRequests.set(requestId, resolve);
        });

        this.handleMessage(ioMessage);

        const timeout = setTimeout(() => {
            if (this.pendingRequests.has(requestId)) {
                this.pendingRequests.delete(requestId);
                if (!res.writableEnded) {
                    res.statusCode = 408;
                    res.end(JSON.stringify({error: {code: 'TIMEOUT', message: 'Handler timeout'}}));
                }
            }
        }, 30000);

        try {
            const responseText = await responsePromise;
            clearTimeout(timeout);
            if (!res.writableEnded) {
                res.statusCode = 200;
                res.end(JSON.stringify({type: 'response', data: responseText, timestamp: Date.now()}));
            }
        } catch (e) {
            clearTimeout(timeout);
            if (!res.writableEnded) {
                res.statusCode = 500;
                res.end(
                    JSON.stringify({error: {code: 'INTERNAL_ERROR', message: (e as Error).message}})
                );
            }
        }
    }
}
