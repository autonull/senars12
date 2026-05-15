/**
 * Unified API Registry
 * Centralized handler registration with Zod validation for HTTP, WebSocket, and MCP
 */

import {z} from 'zod';

export interface HandlerMeta<T = unknown> {
    name: string;
    description: string;
    params: z.ZodSchema<T>;
    returns: z.ZodSchema;
    handler: (args: T) => Promise<unknown>;
}

export interface APISpec {
    handlers: Record<string, HandlerMeta>;
}

export class APIRegistry {
    private static instance: APIRegistry | null = null;
    private handlers: Map<string, HandlerMeta> = new Map();

    private constructor() {
    }

    static getInstance(): APIRegistry {
        if (!APIRegistry.instance) {
            APIRegistry.instance = new APIRegistry();
        }
        return APIRegistry.instance;
    }

    static reset(): void {
        APIRegistry.instance = new APIRegistry();
    }

    register<T>(
        name: string,
        schema: {
            description: string;
            params: z.ZodSchema<T>;
            returns: z.ZodSchema<unknown>;
            handler: (args: T) => Promise<unknown>;
        }
    ): void {
        this.handlers.set(name, {
            name,
            description: schema.description,
            params: schema.params,
            returns: schema.returns,
            handler: schema.handler as (args: unknown) => Promise<unknown>,
        });
    }

    async invoke<T>(name: string, args: T): Promise<unknown> {
        const handler = this.handlers.get(name) as HandlerMeta<T> | undefined;
        if (!handler) {
            throw new Error(`Handler ${name} not found`);
        }
        const validated = handler.params.parse(args);
        return handler.handler(validated);
    }

    hasHandler(name: string): boolean {
        return this.handlers.has(name);
    }

    getHandler(name: string): HandlerMeta | undefined {
        return this.handlers.get(name);
    }

    getHandlers(): Map<string, HandlerMeta> {
        return this.handlers;
    }

    getSpec(): Record<string, { name: string; description: string; params: z.ZodSchema; returns: z.ZodSchema }> {
        const spec: Record<string, {
            name: string;
            description: string;
            params: z.ZodSchema;
            returns: z.ZodSchema
        }> = {};
        for (const [name, meta] of this.handlers) {
            spec[name] = {
                name: meta.name,
                description: meta.description,
                params: meta.params,
                returns: meta.returns,
            };
        }
        return spec;
    }

    getOpenAPISpec(): {
        openapi: string;
        info: { title: string; version: string; description: string };
        paths: Record<string, unknown>
    } {
        return {
            openapi: '3.0.0',
            info: {
                title: 'SeNARS Unified API',
                version: '1.0.0',
                description: 'Unified API for SeNARS reasoning engine',
            },
            paths: Array.from(this.handlers.values()).reduce((acc, meta) => {
                acc[`/${meta.name}`] = {
                    post: {
                        summary: meta.description,
                        requestBody: {
                            content: {
                                'application/json': {
                                    schema: meta.params,
                                },
                            },
                        },
                        responses: {
                            '200': {
                                description: 'Success',
                            },
                        },
                    },
                };
                return acc;
            }, {} as Record<string, unknown>),
        };
    }
}

export function apiMethod<T>(config: {
    description: string;
    params: z.ZodSchema<T>;
    returns: z.ZodSchema<unknown>;
}) {
    return (target: Record<string, unknown>, propertyKey: string) => {
        const registry = APIRegistry.getInstance();
        registry.register(propertyKey, {
            description: config.description,
            params: config.params,
            returns: config.returns,
            handler: target[propertyKey] as (args: T) => Promise<unknown>,
        });
    };
}
