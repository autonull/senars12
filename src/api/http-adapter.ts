/**
 * HTTP Adapter for Unified API Registry
 * Adapts HTTP requests to registry handlers
 */

import { randomBytes } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { errMsg } from '../../nar/src/utils';
import { ApiKeyManager, parseHttpBody, setCORSHeaders } from '../io/utils/http.js';
import { BaseAdapter, errorResponse } from './base-adapter.js';

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

export class HTTPAdapter extends BaseAdapter {
  private config: Required<HTTPAdapterConfig>;
  private rateLimitState = new Map<string, RateLimitState>();
  private apiKeys = new ApiKeyManager();

  constructor(registry?: any, config: HTTPAdapterConfig = {}) {
    super('api:http');
    this.config = {
      port: config.port ?? 8080,
      apiKey: config.apiKey ?? randomBytes(32).toString('hex'),
      enableCors: config.enableCors ?? true,
      rateLimit: config.rateLimit ?? { windowMs: 60000, maxRequests: 100 },
    };
    if (this.config.apiKey) this.apiKeys.add(this.config.apiKey);
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

  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', 'http://localhost');
    const method = req.method || 'GET';

    if (this.config.enableCors) setCORSHeaders(res);
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
        res.end(
          JSON.stringify({
            type: 'error',
            error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
            timestamp: Date.now(),
          })
        );
        return;
      }

      if (this.config.rateLimit && this.checkRateLimit(apiKey || 'anonymous')) {
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
      res.end(JSON.stringify(result));
    } catch (error: unknown) {
      res.statusCode = 400;
      res.end(JSON.stringify(errorResponse('HANDLER_ERROR', errMsg(error))));
    }
  }

  private checkRateLimit(key: string): boolean {
    const now = Date.now();
    const state = this.rateLimitState.get(key);
    const { windowMs, maxRequests } = this.config.rateLimit;

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
