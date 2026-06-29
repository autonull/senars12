/**
 * Unified HTTP Adapter
 * Uses the new unified adapter pattern
 */

import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { errMsg } from '../../nar/src/utils';
import { ApiKeyManager, parseHttpBody, setCORSHeaders } from '../io/utils/http.js';
import { APIResponse, UnifiedAdapter, errorResponse, successResponse } from './unified-adapter.js';

export interface HTTPAdapterConfig {
  port?: number;
  apiKey?: string;
  enableCors?: boolean;
  rateLimit?: { windowMs: number; maxRequests: number };
}

interface RateLimitState {
  count: number;
  resetTime: number;
}

export class HTTPAdapter extends UnifiedAdapter {
  private httpConfig: Required<HTTPAdapterConfig>;
  private rateLimitState = new Map<string, RateLimitState>();
  private apiKeys = new ApiKeyManager();
  private server: ReturnType<typeof import('node:http').createServer> | null = null;

  constructor(config: HTTPAdapterConfig = {}) {
    super({
      transport: 'http',
      loggerScope: 'api:http',
      port: config.port ?? 8080,
    });

    this.httpConfig = {
      port: config.port ?? 8080,
      apiKey: config.apiKey ?? randomBytes(32).toString('hex'),
      enableCors: config.enableCors ?? true,
      rateLimit: config.rateLimit ?? { windowMs: 60000, maxRequests: 100 },
    };
    if (this.httpConfig.apiKey) this.apiKeys.add(this.httpConfig.apiKey);
  }

  addApiKey(key: string): void {
    this.apiKeys.add(key);
  }

  removeApiKey(key: string): void {
    this.apiKeys.remove(key);
  }

  getOpenAPISpec(): Record<string, unknown> {
    return this.registry.getOpenAPISpec();
  }

  async start(): Promise<void> {
    const { createServer } = await import('node:http');

    return new Promise((resolve, reject) => {
      try {
        this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
          this.handleRequest(req, res).catch((err) => {
            this.logger.error('Request handler error', err);
          });
        });

        this.server.on('listening', () => {
          this.logger.info(`HTTP adapter listening on port ${this.httpConfig.port}`);
          this.isRunning = true;
          resolve();
        });

        this.server.on('error', (error: Error) => {
          this.logger.error('HTTP adapter error', error);
          reject(error);
        });

        this.server.listen(this.httpConfig.port);
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;

    return new Promise((resolve) => {
      this.server?.close(() => {
        this.isRunning = false;
        this.logger.info('HTTP adapter closed');
        resolve();
      });
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', 'http://localhost');
    const method = req.method || 'GET';

    if (this.httpConfig.enableCors) setCORSHeaders(res);
    res.setHeader('Content-Type', 'application/json');

    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

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

    if (!url.pathname.startsWith('/docs')) {
      const apiKey = req.headers['x-api-key'] as string;
      if (!this.apiKeys.has(apiKey)) {
        res.statusCode = 401;
        res.end(JSON.stringify(errorResponse('UNAUTHORIZED', 'Unauthorized')));
        return;
      }

      if (this.httpConfig.rateLimit && this.checkRateLimit(apiKey || 'anonymous')) {
        res.statusCode = 429;
        res.end(JSON.stringify(errorResponse('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded')));
        return;
      }
    }

    try {
      const body = await this.parseBody(req);
      if (body === null) {
        res.statusCode = 400;
        res.end(JSON.stringify(errorResponse('INVALID_JSON', 'Invalid JSON body')));
        return;
      }

      const handlerName = url.pathname.slice(1);
      if (!this.registry.hasHandler(handlerName)) {
        res.statusCode = 404;
        res.end(JSON.stringify(errorResponse('HANDLER_NOT_FOUND', 'Handler not found')));
        return;
      }

      const result = await this.registry.invoke(handlerName, body);
      res.statusCode = 200;
      res.end(JSON.stringify(successResponse(result as Record<string, unknown>)));
    } catch (error: unknown) {
      res.statusCode = 400;
      res.end(JSON.stringify(errorResponse('HANDLER_ERROR', errMsg(error))));
    }
  }

  private checkRateLimit(key: string): boolean {
    const now = Date.now();
    const state = this.rateLimitState.get(key);
    const { windowMs, maxRequests } = this.httpConfig.rateLimit;

    if (!state || now > state.resetTime) {
      this.rateLimitState.set(key, { count: 1, resetTime: now + windowMs });
      return false;
    }

    if (state.count >= maxRequests) return true;
    state.count++;
    return false;
  }

  private async parseBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
    if (req.method === 'GET' || req.method === 'HEAD') return {};
    try {
      const body = await parseHttpBody(req);
      return body ? JSON.parse(body) : {};
    } catch {
      return null;
    }
  }
}
