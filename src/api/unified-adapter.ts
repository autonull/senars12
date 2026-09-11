/**
 * Unified Adapter Base Class
 * Common pattern for HTTP, WebSocket, and MCP adapters
 */

import type {z} from 'zod';
import {createLogger, type Logger} from '../../nar/src/logger';
import {APIRegistry} from './registry.js';
import {type APIResponse, errorResponse, formatError, sendJSON, successResponse} from './response.js';

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

export abstract class UnifiedAdapter {
    protected readonly registry: APIRegistry;
    protected readonly logger: Logger;
    protected config: Required<AdapterConfig>;
    protected isRunning = false;

    protected constructor(config: AdapterConfig) {
        this.registry = APIRegistry.getInstance();
        this.logger = createLogger({scope: config.loggerScope});
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
        sendJSON(ws, response);
    }

    protected successResponse = <T extends Record<string, unknown> = Record<string, unknown>>(
        data: T,
        id?: string
    ): APIResponse<T> => successResponse(data, id);

    protected errorResponse = (code: string, message: string, id?: string): APIResponse =>
        errorResponse(code, message, id);

    protected formatError = formatError;
}

export {APIRegistry, type APIResponse, errorResponse, formatError, sendJSON, successResponse};
