/**
 * HTTP Adapter for Unified API Registry
 * Adapts HTTP requests to registry handlers
 */

import {IncomingMessage, ServerResponse} from 'http';
import {URL} from 'url';
import {randomBytes} from 'crypto';
import {BaseAdapter} from './base-adapter.js';

export interface HTTPAdapterConfig {
    port?: number;
    apiKey?: string;
    enableCors?: boolean;
    rateLimit?: {
        windowMs: number;
        maxRequests: number;
    };
}

interface RateLimitState {
    count: number;
    resetTime: number;
}

export class HTTPAdapter extends BaseAdapter {
    private config: Required<HTTPAdapterConfig>;
    private rateLimitState: Map<string, RateLimitState> = new Map();
    private apiKeys: Set<string> = new Set();

    constructor(registry?: any, config: HTTPAdapterConfig = {}) {
        super('api:http');
        this.config = {
            port: config.port ?? 8080,
            apiKey: config.apiKey ?? randomBytes(32).toString('hex'),
            enableCors: config.enableCors ?? true,
            rateLimit: config.rateLimit ?? {windowMs: 60000, maxRequests: 100},
        };
        if (this.config.apiKey) {
            this.apiKeys.add(this.config.apiKey);
        }
    }

    addApiKey(key: string): void {
        this.apiKeys.add(key);
    }

    removeApiKey(key: string): void {
        this.apiKeys.delete(key);
    }

    getOpenAPISpec(): Record<string, unknown> {
        return this.registry.getOpenAPISpec();
    }

    async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const url = new URL(req.url || '/', 'http://localhost');
        const method = req.method || 'GET';

        if (this.config.enableCors) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
        }
        res.setHeader('Content-Type', 'application/json');

        if (method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
        }

        // Health and OpenAPI endpoints (no auth required)
        if (url.pathname === '/health') {
            const result = await this.registry.invoke('getHealth', {});
            res.statusCode = 200;
            res.end(JSON.stringify(result));
            return;
        }

        if (url.pathname === '/openapi' || url.pathname === '/openapi.json') {
            res.statusCode = 200;
            res.end(JSON.stringify(this.registry.getOpenAPISpec()));
            return;
        }

        // Auth required for other endpoints
        if (!url.pathname.startsWith('/docs')) {
            const apiKey = req.headers['x-api-key'] as string;
            if (!this.authenticate(apiKey)) {
                res.statusCode = 401;
                res.end(JSON.stringify({
                    type: 'error',
                    error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
                    timestamp: Date.now(),
                }));
                return;
            }

            if (this.config.rateLimit) {
                const limited = this.checkRateLimit(apiKey || 'anonymous');
                if (limited) {
                    res.statusCode = 429;
                    res.end(JSON.stringify({
                        type: 'error',
                        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded' },
                        timestamp: Date.now(),
                    }));
                    return;
                }
            }
        }

        // Route to handler
        try {
            const body = await this.parseBody(req);
            const handlerName = url.pathname.slice(1); // Remove leading '/'

            if (!this.registry.hasHandler(handlerName)) {
                res.statusCode = 404;
                res.end(JSON.stringify({
                    type: 'error',
                    error: { code: 'HANDLER_NOT_FOUND', message: 'Handler not found' },
                    timestamp: Date.now(),
                }));
                return;
            }

            const result = await this.registry.invoke(handlerName, body);
            res.statusCode = 200;
            res.end(JSON.stringify(result));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            res.statusCode = 400;
            res.end(JSON.stringify({
                type: 'error',
                error: { code: 'HANDLER_ERROR', message },
                timestamp: Date.now(),
            }));
        }
    }

    private authenticate(apiKey: string | undefined): boolean {
        if (!apiKey) return false;
        return this.apiKeys.has(apiKey);
    }

    private checkRateLimit(key: string): boolean {
        const now = Date.now();
        const state = this.rateLimitState.get(key);
        const {windowMs, maxRequests} = this.config.rateLimit;

        if (!state || now > state.resetTime) {
            this.rateLimitState.set(key, {count: 1, resetTime: now + windowMs});
            return false;
        }

        if (state.count >= maxRequests) {
            return true;
        }

        state.count++;
        return false;
    }

    private async parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
        return new Promise((resolve) => {
            if (req.method === 'GET' || req.method === 'HEAD') {
                resolve({});
                return;
            }

            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', () => {
                try {
                    resolve(body ? JSON.parse(body) : {});
                } catch {
                    resolve({});
                }
            });
        });
    }
}
