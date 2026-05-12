/**
 * HTTP API Server
 * RESTful API for SeNARS with SSE for real-time events
 */

import {Agent} from './Agent';
import {createServer, IncomingMessage, ServerResponse} from 'http';
import {URL} from 'url';
import {randomBytes} from 'crypto';

interface HTTPRequest {
    method: string;
    url: string;
    body?: unknown;
}

interface HTTPResponse {
    statusCode: number;
    body: unknown;
    headers?: Record<string, string>;
}

interface RateLimitState {
    count: number;
    resetTime: number;
}

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
    private agent: Agent | null = null;
    private config: Required<HTTPServerConfig>;
    private rateLimitState: Map<string, RateLimitState> = new Map();
    private apiKeys: Set<string> = new Set();
    private clients: Set<ServerResponse> = new Set();

    constructor(config: HTTPServerConfig = {}) {
        this.config = {
            port: config.port ?? 8080,
            apiKey: config.apiKey ?? randomBytes(32).toString('hex'),
            rateLimit: config.rateLimit ?? {windowMs: 60000, maxRequests: 100},
            enableCors: config.enableCors ?? true
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
        return {
            openapi: '3.0.0',
            info: {
                title: 'SeNARS API',
                version: '1.0.0',
                description: 'RESTful API for SeNARS reasoning engine'
            },
            servers: [{url: `http://localhost:${this.config.port}`}],
            paths: {
                '/beliefs': {
                    get: {summary: 'List all beliefs', responses: {'200': {description: 'List of beliefs'}}},
                    post: {
                        summary: 'Add a new belief',
                        requestBody: {
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {term: {type: 'string'}, truth: {type: 'object'}}
                                    }
                                }
                            }
                        },
                        responses: {'200': {description: 'Belief added'}}
                    }
                },
                '/goals': {
                    get: {summary: 'List all goals', responses: {'200': {description: 'List of goals'}}},
                    post: {
                        summary: 'Add a new goal',
                        requestBody: {
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {term: {type: 'string'}}
                                    }
                                }
                            }
                        },
                        responses: {'200': {description: 'Goal added'}}
                    }
                },
                '/questions': {
                    get: {summary: 'List all questions', responses: {'200': {description: 'List of questions'}}},
                    post: {
                        summary: 'Add a new question',
                        requestBody: {
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {term: {type: 'string'}}
                                    }
                                }
                            }
                        },
                        responses: {'200': {description: 'Question added'}}
                    }
                },
                '/query': {
                    post: {
                        summary: 'Query memory',
                        requestBody: {content: {'application/json': {schema: {type: 'object'}}}},
                        responses: {'200': {description: 'Query results'}}
                    }
                },
                '/ask': {
                    post: {
                        summary: 'Ask a question',
                        requestBody: {
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {question: {type: 'string'}}
                                    }
                                }
                            }
                        },
                        responses: {'200': {description: 'Answer'}}
                    }
                },
                '/stats': {
                    get: {summary: 'Get system statistics', responses: {'200': {description: 'Statistics'}}}
                },
                '/health': {
                    get: {summary: 'Health check', responses: {'200': {description: 'Health status'}}}
                },
                '/events': {
                    get: {summary: 'Stream events (SSE)', responses: {'200': {description: 'Event stream'}}}
                }
            },
            components: {
                securitySchemes: {
                    ApiKeyAuth: {
                        type: 'apiKey',
                        in: 'header',
                        name: 'X-API-Key'
                    }
                }
            },
            security: [{ApiKeyAuth: []}]
        };
    }

    async start(agent: Agent): Promise<void> {
        this.agent = agent;

        return new Promise((resolve, reject) => {
            try {
                this.server = createServer((req, res) => {
                    this.handleRequest(req, res).catch((error) => {
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

            for (const client of this.clients) {
                client.destroy();
            }
            this.clients.clear();

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

    private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

        if (url.pathname !== '/health' && !url.pathname.startsWith('/openapi')) {
            const apiKey = req.headers['x-api-key'] as string;
            if (!this.authenticate(apiKey)) {
                res.statusCode = 401;
                res.end(JSON.stringify({error: 'Unauthorized'}));
                return;
            }

            if (this.config.rateLimit) {
                const limited = this.checkRateLimit(apiKey || 'anonymous');
                if (limited) {
                    res.statusCode = 429;
                    res.end(JSON.stringify({error: 'Rate limit exceeded'}));
                    return;
                }
            }
        }

        try {
            const response = await this.routeRequest({method, url: url.pathname, body: await this.parseBody(req)});
            res.statusCode = response.statusCode;
            res.end(JSON.stringify(response.body));
        } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({error: error instanceof Error ? error.message : String(error)}));
        }
    }

    private authenticate(apiKey: string | undefined): boolean {
        if (!apiKey) return false;
        return this.apiKeys.has(apiKey);
    }

    private checkRateLimit(key: string): boolean {
        const now = Date.now();
        const state = this.rateLimitState.get(key);
        const rateLimit = this.config.rateLimit;
        if (!rateLimit) return false;
        const {windowMs, maxRequests} = rateLimit;

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

    private async parseBody(req: IncomingMessage): Promise<unknown> {
        return new Promise((resolve) => {
            if (req.method === 'GET' || req.method === 'HEAD') {
                resolve(null);
                return;
            }

            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', () => {
                try {
                    resolve(body ? JSON.parse(body) : null);
                } catch {
                    resolve(null);
                }
            });
        });
    }

    private async routeRequest(req: HTTPRequest): Promise<HTTPResponse> {
        const {method, url} = req;

        if (url === '/openapi' || url === '/openapi.json') {
            return {statusCode: 200, body: this.getOpenAPISpec()};
        }

        if (url === '/docs' || url === '/docs/') {
            return this.getSwaggerUI();
        }

        const routes: Record<string, Record<string, (req: HTTPRequest) => Promise<HTTPResponse>>> = {
            '/beliefs': {
                GET: () => this.getBeliefs(),
                POST: () => this.addBelief(req)
            },
            '/goals': {
                GET: () => this.getGoals(),
                POST: () => this.addGoal(req)
            },
            '/questions': {
                GET: () => this.getQuestions(),
                POST: () => this.addQuestion(req)
            },
            '/query': {
                POST: () => this.query(req)
            },
            '/ask': {
                POST: () => this.ask(req)
            },
            '/stats': {
                GET: () => this.getStats()
            },
            '/health': {
                GET: () => this.getHealth()
            },
            '/events': {
                GET: () => this.getEvents()
            }
        };

        const v1Routes: Record<string, Record<string, (req: HTTPRequest) => Promise<HTTPResponse>>> = {
            '/v1/beliefs': {
                GET: () => this.getBeliefs(req),
                POST: () => this.addBelief(req)
            },
            '/v1/goals': {
                GET: () => this.getGoals(req),
                POST: () => this.addGoal(req)
            },
            '/v1/questions': {
                GET: () => this.getQuestions(req),
                POST: () => this.addQuestion(req)
            },
            '/v1/query': {
                POST: () => this.query(req)
            },
            '/v1/ask': {
                POST: () => this.ask(req)
            },
            '/v1/stats': {
                GET: () => this.getStats()
            },
            '/v1/health': {
                GET: () => this.getHealth()
            }
        };

        const path = url || '/';
        const route = v1Routes[path] || routes[path.split('/')[1] || ''];
        const handler = route?.[method || 'GET'];
        if (route && handler) {
            return await handler(req);
        }

        return {statusCode: 404, body: {error: 'Not found'}};
    }

    private async getBeliefs(req?: HTTPRequest): Promise<HTTPResponse> {
        if (!this.agent) {
            return {statusCode: 503, body: {error: 'Agent not initialized'}};
        }

        const nar = this.agent.getNAR();
        const beliefs = nar.getBeliefs();
        const url = req?.url ? new URL(req.url, 'http://localhost') : null;
        const page = parseInt(url?.searchParams.get('page') || '1', 10);
        const limit = Math.min(parseInt(url?.searchParams.get('limit') || '20', 10), 100);
        const start = (page - 1) * limit;
        const paginated = beliefs.slice(start, start + limit);
        const baseUrl = url?.pathname || '/beliefs';

        const response: HTTPResponse = {
            statusCode: 200,
            body: {
                beliefs: paginated.map(b => b.term.toString()),
                pagination: {page, limit, total: beliefs.length, totalPages: Math.ceil(beliefs.length / limit)}
            }
        };

        if (page < Math.ceil(beliefs.length / limit)) {
            response.headers = {'Link': `<${baseUrl}?page=${page + 1}&limit=${limit}>; rel="next"`};
        }
        return response;
    }

    private async addBelief(req: HTTPRequest): Promise<HTTPResponse> {
        if (!this.agent) {
            return {statusCode: 503, body: {error: 'Agent not initialized'}};
        }

        const nar = this.agent.getNAR();
        const belief = req.body as { term: string; truth?: { f: number; c: number } };

        if (!belief.term) {
            return {statusCode: 400, body: {error: 'Term is required'}};
        }

        try {
            await nar.input(belief.term);
            return {statusCode: 200, body: {success: true, term: belief.term}};
        } catch (error) {
            return {statusCode: 400, body: {error: error instanceof Error ? error.message : String(error)}};
        }
    }

    private async getGoals(req?: HTTPRequest): Promise<HTTPResponse> {
        if (!this.agent) {
            return {statusCode: 503, body: {error: 'Agent not initialized'}};
        }

        const nar = this.agent.getNAR();
        const goals = nar.getGoals();
        const url = req?.url ? new URL(req.url, 'http://localhost') : null;
        const page = parseInt(url?.searchParams.get('page') || '1', 10);
        const limit = Math.min(parseInt(url?.searchParams.get('limit') || '20', 10), 100);
        const start = (page - 1) * limit;
        const paginated = goals.slice(start, start + limit);
        const baseUrl = url?.pathname || '/goals';

        const response: HTTPResponse = {
            statusCode: 200,
            body: {
                goals: paginated.map(g => g.term.toString()),
                pagination: {page, limit, total: goals.length, totalPages: Math.ceil(goals.length / limit)}
            }
        };

        if (page < Math.ceil(goals.length / limit)) {
            response.headers = {'Link': `<${baseUrl}?page=${page + 1}&limit=${limit}>; rel="next"`};
        }
        return response;
    }

    private async addGoal(req: HTTPRequest): Promise<HTTPResponse> {
        if (!this.agent) {
            return {statusCode: 503, body: {error: 'Agent not initialized'}};
        }

        const nar = this.agent.getNAR();
        const goal = req.body as { term: string };

        if (!goal.term) {
            return {statusCode: 400, body: {error: 'Term is required'}};
        }

        try {
            await nar.input(`${goal.term}!`);
            return {statusCode: 200, body: {success: true, term: goal.term}};
        } catch (error) {
            return {statusCode: 400, body: {error: error instanceof Error ? error.message : String(error)}};
        }
    }

    private async getQuestions(req?: HTTPRequest): Promise<HTTPResponse> {
        if (!this.agent) {
            return {statusCode: 503, body: {error: 'Agent not initialized'}};
        }

        const nar = this.agent.getNAR();
        const questions = nar.getQuestions();
        const url = req?.url ? new URL(req.url, 'http://localhost') : null;
        const page = parseInt(url?.searchParams.get('page') || '1', 10);
        const limit = Math.min(parseInt(url?.searchParams.get('limit') || '20', 10), 100);
        const start = (page - 1) * limit;
        const paginated = questions.slice(start, start + limit);
        const baseUrl = url?.pathname || '/questions';

        const response: HTTPResponse = {
            statusCode: 200,
            body: {
                questions: paginated.map(q => q.term.toString()),
                pagination: {page, limit, total: questions.length, totalPages: Math.ceil(questions.length / limit)}
            }
        };

        if (page < Math.ceil(questions.length / limit)) {
            response.headers = {'Link': `<${baseUrl}?page=${page + 1}&limit=${limit}>; rel="next"`};
        }
        return response;
    }

    private async addQuestion(req: HTTPRequest): Promise<HTTPResponse> {
        if (!this.agent) {
            return {statusCode: 503, body: {error: 'Agent not initialized'}};
        }

        const nar = this.agent.getNAR();
        const question = req.body as { term: string };

        if (!question.term) {
            return {statusCode: 400, body: {error: 'Term is required'}};
        }

        try {
            await nar.input(`${question.term}?`);
            return {statusCode: 200, body: {success: true, term: question.term}};
        } catch (error) {
            return {statusCode: 400, body: {error: error instanceof Error ? error.message : String(error)}};
        }
    }

    private async query(_req: HTTPRequest): Promise<HTTPResponse> {
        return {
            statusCode: 501,
            body: {error: 'Query not yet implemented'}
        };
    }

    private async ask(req: HTTPRequest): Promise<HTTPResponse> {
        if (!this.agent) {
            return {statusCode: 503, body: {error: 'Agent not initialized'}};
        }

        const {question} = req.body as { question: string };

        if (!question) {
            return {statusCode: 400, body: {error: 'Question is required'}};
        }

        try {
            const nar = this.agent.getNAR();
            await nar.input(question);
            const derived = await nar.run(5);
            return {
                statusCode: 200,
                body: {
                    answer: derived > 0 ? `Found ${derived} derivations` : 'No answer found',
                    derivations: derived
                }
            };
        } catch (error) {
            return {statusCode: 400, body: {error: error instanceof Error ? error.message : String(error)}};
        }
    }

    private async getStats(): Promise<HTTPResponse> {
        if (!this.agent) {
            return {statusCode: 503, body: {error: 'Agent not initialized'}};
        }
        const nar = this.agent.getNAR();
        const stats = nar.getStatistics();
        const metrics = nar.getMetrics();
        return {
            statusCode: 200,
            body: {
                totalConcepts: stats.totalConcepts,
                totalTasks: stats.totalTasks,
                rulesFired: metrics.system.totalSteps || 0,
                derivations: metrics.system.totalDerivations || 0
            }
        };
    }

private async getHealth(): Promise<HTTPResponse> {
const nar = this.agent?.getNAR();
const stats = nar?.getStatistics();
const _metrics = nar?.getMetrics();
const lm = nar?.getLMClient?.();

        return {
            statusCode: 200,
            body: {
                status: 'healthy',
                timestamp: Date.now(),
                uptime: process.uptime(),
                memory: {
                    concepts: stats?.totalConcepts ?? 0,
                    tasks: stats?.totalTasks ?? 0
                },
                lm: lm ? {
                    available: true,
                    provider: (lm as any).provider ?? 'unknown',
                    model: (lm as any).model ?? 'unknown'
                } : {available: false}
            }
        };
    }

    private async getEvents(): Promise<HTTPResponse> {
        return {
            statusCode: 200,
            body: {message: 'SSE not implemented in this version'}
        };
    }

    private getSwaggerUI(): HTTPResponse {
        const html = `<!DOCTYPE html>
<html>
<head>
    <title>SeNARS API - Swagger UI</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
    <style>body { margin: 0; }</style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = () => {
            window.SwaggerUIBundle({
                url: '/openapi.json',
                dom_id: '#swagger-ui',
                presets: [window.SwaggerUIBundle.presets.apis]
            });
        };
    </script>
</body>
</html>`;
        return {
            statusCode: 200,
            body: html,
            headers: {'Content-Type': 'text/html'}
        };
    }
}
