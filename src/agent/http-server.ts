/**
 * HTTP API Server - Refactored to use Unified API Registry
 * RESTful API for SeNARS with adapter pattern
 */

import {Agent} from './Agent';
import {createServer} from 'http';
import {HTTPAdapter} from '../api/index.js';
import {createLogger, type Logger} from '../nar/logger/index.js';
import {errMsg} from '../nar/utils/index.js';

export interface HTTPServerConfig {
    port?: number;
    apiKey?: string;
    rateLimit?: {
        windowMs: number;
        maxRequests: number;
    };
    enableCors?: boolean;
}

export class HTTPServer {
    private server: ReturnType<typeof createServer> | null = null;
    private adapter: HTTPAdapter;
    private readonly config: {port: number; enableCors: boolean};
    private readonly logger: Logger;

    constructor(config: HTTPServerConfig = {}) {
        this.logger = createLogger({scope: 'agent:http-server'});
        this.config = {port: config.port ?? 8080, enableCors: config.enableCors ?? true};
        this.adapter = new HTTPAdapter(undefined, {
            port: this.config.port,
            apiKey: config.apiKey,
            rateLimit: config.rateLimit,
            enableCors: config.enableCors,
        });
    }

    async start(_agent: Agent): Promise<void> {
        this.server = createServer((req, res) =>
            this.adapter.handleRequest(req, res).catch(err => {
                this.logger.error(`HTTP request error: ${errMsg(err)}`);
                res.statusCode = 500;
                res.end(JSON.stringify({error: 'Internal server error'}));
            })
        );
        await new Promise<void>((resolve, reject) => {
            this.server!.listen(this.config.port, resolve);
            this.server!.once('error', reject);
        });
        this.logger.info(`HTTP server listening on port ${this.config.port}`);
    }

    async stop(): Promise<void> {
        if (!this.server) return;
        await new Promise<void>((resolve, reject) => this.server!.close(err => err ? reject(err) : resolve()));
        this.logger.info('HTTP server closed');
    }

    addApiKey(key: string): void { this.adapter.addApiKey(key); }
    removeApiKey(key: string): void { this.adapter.removeApiKey(key); }
    getOpenAPISpec(): Record<string, unknown> { return this.adapter.getOpenAPISpec?.() ?? {}; }
}
