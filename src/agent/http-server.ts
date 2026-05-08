/**
 * HTTP API Server
 * RESTful API for SeNARS with SSE for real-time events
 */

import { Agent } from '../agent/Agent.js';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';

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

export class HTTPServer {
  private server: ReturnType<typeof createServer> | null = null;
  private agent: Agent | null = null;
  private port: number;
  private clients: Set<ServerResponse> = new Set();

  constructor(port: number = 8080) {
    this.port = port;
  }

  async start(agent: Agent): Promise<void> {
    this.agent = agent;

    return new Promise((resolve, reject) => {
      try {
        this.server = createServer((req, res) => {
          this.handleRequest(req, res).catch((error) => {
            console.error('HTTP request error:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Internal server error' }));
          });
        });

        this.server.listen(this.port, () => {
          console.log(`HTTP server listening on port ${this.port}`);
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

    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }

    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      const response = await this.routeRequest({ method, url: url.pathname, body: await this.parseBody(req) });
      res.statusCode = response.statusCode;
      res.end(JSON.stringify(response.body));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
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
    const { method, url } = req;

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

    const route = routes[url?.split('/')[1] || ''];
    if (route && route[method || 'GET']) {
      return await route[method || 'GET'](req);
    }

    return { statusCode: 404, body: { error: 'Not found' } };
  }

  private async getBeliefs(): Promise<HTTPResponse> {
    if (!this.agent) {
      return { statusCode: 503, body: { error: 'Agent not initialized' } };
    }

    const nar = this.agent.getNAR();
    const beliefs = nar.getBeliefs();
    return {
      statusCode: 200,
      body: { beliefs: beliefs.map(b => b.term.toString()) }
    };
  }

  private async addBelief(req: HTTPRequest): Promise<HTTPResponse> {
    if (!this.agent) {
      return { statusCode: 503, body: { error: 'Agent not initialized' } };
    }

    const nar = this.agent.getNAR();
    const belief = req.body as { term: string; truth?: { f: number; c: number } };

    if (!belief.term) {
      return { statusCode: 400, body: { error: 'Term is required' } };
    }

    try {
      await nar.input(belief.term);
      return { statusCode: 200, body: { success: true, term: belief.term } };
    } catch (error) {
      return { statusCode: 400, body: { error: error instanceof Error ? error.message : String(error) } };
    }
  }

  private async getGoals(): Promise<HTTPResponse> {
    if (!this.agent) {
      return { statusCode: 503, body: { error: 'Agent not initialized' } };
    }

    const nar = this.agent.getNAR();
    const goals = nar.getGoals();
    return {
      statusCode: 200,
      body: { goals: goals.map(g => g.term.toString()) }
    };
  }

  private async addGoal(req: HTTPRequest): Promise<HTTPResponse> {
    if (!this.agent) {
      return { statusCode: 503, body: { error: 'Agent not initialized' } };
    }

    const nar = this.agent.getNAR();
    const goal = req.body as { term: string };

    if (!goal.term) {
      return { statusCode: 400, body: { error: 'Term is required' } };
    }

    try {
      await nar.input(`${goal.term}!`);
      return { statusCode: 200, body: { success: true, term: goal.term } };
    } catch (error) {
      return { statusCode: 400, body: { error: error instanceof Error ? error.message : String(error) } };
    }
  }

  private async getQuestions(): Promise<HTTPResponse> {
    if (!this.agent) {
      return { statusCode: 503, body: { error: 'Agent not initialized' } };
    }

    const nar = this.agent.getNAR();
    const questions = nar.getQuestions();
    return {
      statusCode: 200,
      body: { questions: questions.map(q => q.term.toString()) }
    };
  }

  private async addQuestion(req: HTTPRequest): Promise<HTTPResponse> {
    if (!this.agent) {
      return { statusCode: 503, body: { error: 'Agent not initialized' } };
    }

    const nar = this.agent.getNAR();
    const question = req.body as { term: string };

    if (!question.term) {
      return { statusCode: 400, body: { error: 'Term is required' } };
    }

    try {
      await nar.input(`${question.term}?`);
      return { statusCode: 200, body: { success: true, term: question.term } };
    } catch (error) {
      return { statusCode: 400, body: { error: error instanceof Error ? error.message : String(error) } };
    }
  }

  private async query(req: HTTPRequest): Promise<HTTPResponse> {
    return {
      statusCode: 501,
      body: { error: 'Query not yet implemented' }
    };
  }

  private async ask(req: HTTPRequest): Promise<HTTPResponse> {
    if (!this.agent) {
      return { statusCode: 503, body: { error: 'Agent not initialized' } };
    }

    const { question } = req.body as { question: string };

    if (!question) {
      return { statusCode: 400, body: { error: 'Question is required' } };
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
      return { statusCode: 400, body: { error: error instanceof Error ? error.message : String(error) } };
    }
  }

  private async getStats(): Promise<HTTPResponse> {
    if (!this.agent) {
      return { statusCode: 503, body: { error: 'Agent not initialized' } };
    }

    const nar = this.agent.getNAR();
    const stats = nar.getStatistics();
    return {
      statusCode: 200,
      body: {
        totalConcepts: stats.totalConcepts,
        totalTasks: stats.totalTasks,
        rulesFired: stats.rulesFired || 0,
        derivations: stats.derivations || 0
      }
    };
  }

  private async getHealth(): Promise<HTTPResponse> {
    return {
      statusCode: 200,
      body: {
        status: 'healthy',
        timestamp: Date.now()
      }
    };
  }

  private async getEvents(): Promise<HTTPResponse> {
    return {
      statusCode: 200,
      body: { message: 'SSE not implemented in this version' }
    };
  }
}
