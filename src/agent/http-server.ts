/**
 * HTTP API Server - Refactored to use Unified API Registry
 * RESTful API for SeNARS with adapter pattern
 */

import {Agent} from './Agent';
import {createServer} from 'http';
import {HTTPAdapter} from '../api/index.js';

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
    private config: any;

    constructor(config: HTTPServerConfig = {}) {
        this.config = {
            port: config.port ?? 8080,
            enableCors: config.enableCors ?? true,
        };
        this.adapter = new HTTPAdapter(undefined, {
            port: this.config.port,
            apiKey: config.apiKey,
            rateLimit: config.rateLimit,
            enableCors: config.enableCors,
        });
    }

    async start(agent: Agent): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.server = createServer((req, res) => {
                    this.adapter.handleRequest(req, res).catch((error) => {
                        console.error('HTTP request error:', error);
                        res.statusCode = 500;
                        res.end(JSON.stringify({error: 'Internal server error'}));
                    });
                });

                this.server.listen(this.config.port, () => {
                    console.log(`HTTP server listening on port ${this.config.port}`);
                    resolve();
                });

                this.server.on('error', (error) => {
                    console.error('HTTP server error:', error);
                    reject(error);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.server) {
                resolve();
                return;
            }

            this.server.close((error) => {
                if (error) {
                    reject(error);
                } else {
                    console.log('HTTP server closed');
                    resolve();
                }
            });
        });
    }

    addApiKey(key: string): void {
        this.adapter.addApiKey(key);
    }

    removeApiKey(key: string): void {
        this.adapter.removeApiKey(key);
    }

    getOpenAPISpec(): Record<string, any> {
        return this.adapter.getOpenAPISpec?.() || {};
    }
}
