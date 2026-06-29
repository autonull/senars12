/**
 * Unified Adapter Base Class
 * Common pattern for HTTP, WebSocket, and MCP adapters
 */

import type { z } from 'zod';
import { type Logger, createLogger } from '../../nar/src/logger';
import { APIRegistry } from './registry.js';

export interface AdapterConfig {
  transport: string;
  loggerScope: string;
  port?: number;
}

export interface HandlerMeta<T = unknown> {
  name: string;
  description: string;
  params: z.ZodSchema<T>;
  returns: z.ZodSchema;
  handler: (args: T) => Promise<unknown>;
}

export interface APIResponse {
  type: 'success' | 'error';
  id?: string;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
  timestamp: number;
}

export const successResponse = (data: Record<string, unknown>, id?: string): APIResponse => ({
  type: 'success',
  id,
  data,
  timestamp: Date.now(),
});

export const errorResponse = (code: string, message: string, id?: string): APIResponse => ({
  type: 'error',
  id,
  error: { code, message },
  timestamp: Date.now(),
});

export abstract class UnifiedAdapter {
  protected readonly registry: APIRegistry;
  protected readonly logger: Logger;
  protected config: Required<AdapterConfig>;
  protected isRunning = false;

  protected constructor(config: AdapterConfig) {
    this.registry = APIRegistry.getInstance();
    this.logger = createLogger({ scope: config.loggerScope });
    this.config = config as Required<AdapterConfig>;
  }

  abstract start(): Promise<void>;

  abstract stop(): Promise<void>;

  getRegistry(): APIRegistry {
    return this.registry;
  }

  isActive(): boolean {
    return this.isRunning;
  }

  protected async invokeHandler<T>(name: string, args: T): Promise<unknown> {
    const handler = this.registry.getHandler(name) as HandlerMeta<T> | undefined;
    if (!handler) {
      throw new Error(`Handler ${name} not found`);
    }
    const validated = handler.params.parse(args);
    return handler.handler(validated);
  }

  protected sendJSON(ws: { send: (data: string) => void }, response: APIResponse): void {
    ws.send(JSON.stringify(response));
  }
}

export { APIRegistry };
