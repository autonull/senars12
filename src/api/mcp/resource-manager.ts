/**
 * MCP Resource Manager
 * Handles resource primitive for MCP protocol
 */

import {ResourceDescriptor} from './types.js';
import {createLogger, type Logger} from '../../nar/logger/index.js';
import {toError} from '../../nar/utils/helpers.js';

/**
 * Resource content structure
 */
export interface ResourceContent {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
    encoding?: string;
}

/**
 * Request context for resource operations
 */
export interface RequestContext {
    userId?: string;
    sessionId?: string;
    permissions?: string[];
}

/**
 * Resource resolver interface
 */
export interface ResourceResolver {
    /**
     * Resolve resource URI to content
     */
    resolve(uri: string, context: RequestContext): Promise<ResourceContent>;

    /**
     * List resources matching template
     */
    list?(template: string, context: RequestContext): Promise<ResourceDescriptor[]>;

    /**
     * Subscribe to resource changes
     */
    subscribe?(
        uri: string,
        callback: (update: ResourceContent) => void
    ): () => void;
}

/**
 * Resource manager for MCP resources
 */
export class ResourceManager {
    private resources: Map<string, ResourceDescriptor> = new Map();
    private resolvers: Map<string, ResourceResolver> = new Map();
    private logger: Logger;

    constructor() {
        this.logger = createLogger({scope: 'api:mcp:resources'});
    }

    /**
     * Register a resource template
     */
    registerResource(descriptor: ResourceDescriptor): void {
        this.resources.set(descriptor.uriTemplate, descriptor);
        this.logger.info(`Registered resource: ${descriptor.name}`);
    }

    /**
     * Unregister a resource
     */
    unregisterResource(uriTemplate: string): void {
        this.resources.delete(uriTemplate);
        this.logger.info(`Unregistered resource: ${uriTemplate}`);
    }

    /**
     * List all registered resources
     */
    listResources(): ResourceDescriptor[] {
        return Array.from(this.resources.values());
    }

    /**
     * Register a resource resolver
     */
    registerResolver(prefix: string, resolver: ResourceResolver): void {
        this.resolvers.set(prefix, resolver);
        this.logger.info(`Registered resolver for prefix: ${prefix}`);
    }

    /**
     * Resolve a resource URI
     */
    async resolve(
        uri: string,
        context: RequestContext = {}
    ): Promise<ResourceContent | null> {
        // Find matching resolver by prefix
        for (const [prefix, resolver] of this.resolvers.entries()) {
            if (uri.startsWith(prefix)) {
                try {
                    return await resolver.resolve(uri, context);
                } catch (error) {
                    this.logger.error(`Failed to resolve ${uri}`, toError(error));
                    throw error;
                }
            }
        }

        throw new Error(`No resolver found for URI: ${uri}`);
    }

    /**
     * List resources matching a template
     */
    async listResourcesByTemplate(
        template: string,
        context: RequestContext = {}
    ): Promise<ResourceDescriptor[]> {
        for (const [_prefix, resolver] of this.resolvers.entries()) {
            if (resolver.list) {
                try {
                    return await resolver.list(template, context);
                } catch (error) {
                    this.logger.error(`Failed to list resources for ${template}`, toError(error));
                }
            }
        }

        // Fallback: return matching registered resources
        const regex = new RegExp(template.replace(/{[^}]+}/g, '([^/]+)'));
        return this.listResources().filter((r) => regex.test(r.uriTemplate));
    }

    /**
     * Subscribe to resource changes
     */
    subscribe(
        uri: string,
        callback: (update: ResourceContent) => void
    ): () => void {
        for (const [_prefix, resolver] of this.resolvers.entries()) {
            if (resolver.subscribe) {
                return resolver.subscribe(uri, callback);
            }
        }

        throw new Error(`No resolver found for URI: ${uri}`);
    }
}
