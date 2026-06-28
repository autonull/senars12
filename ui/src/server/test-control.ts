import http from 'http';
import type { NAR } from '../../../src/nar/nar.js';
import type { NarAdapter } from './gateway.js';
import { setPendingChatResponse } from './gateway.js';

interface MockRequest { body: any; method: string; url: string; headers: http.IncomingHttpHeaders }
interface MockReply {
  status(code: number): { send(data: any): void };
  send(data: any): void;
}

type TestHandler = (req: MockRequest, reply: MockReply) => unknown | Promise<unknown>;

const ROUTES: Record<string, string> = {
  '/test/seed-graph': 'seedGraph',
  '/test/inject-chat': 'injectChat',
  '/test/inject-derivation': 'injectDerivation',
  '/test/state': 'getState',
  '/test/reset': 'reset',
};

function createTestControlApi(nar: NAR): Record<string, TestHandler> {
  return {
    async seedGraph(req) {
      for (const c of req.body.concepts) {
        await nar.believe(`${c.term}. %${c.f};${c.c}%`);
      }
      return { success: true, count: req.body.concepts.length };
    },
    async injectChat(req) {
      setPendingChatResponse(req.body.stream, req.body.complete);
      return { success: true };
    },
    async injectDerivation(req, reply) {
      const { conclusion, frequency = 0.85, confidence = 0.9 } = req.body;
      const termStr = `${conclusion}. %${frequency};${confidence}%`;
      try {
        await nar.believe(termStr);
      } catch (e) {
        return reply.status(500).send({ error: String(e) });
      }
      nar.getSystemEventBus().emit('nar:derivation', { term: conclusion, confidence: frequency, timestamp: Date.now() });
      return { success: true };
    },
    getState() {
      return {
        concepts: nar.listConcepts().map((c: any) => ({
          term: c.term.toString(),
          priority: c.priority,
          confidence: c.getBeliefs()[0]?.truth?.c ?? 0.9,
        })),
        workingMemory: nar.workingMemory.keys(),
      };
    },
    async reset() {
      nar.clearMemory();
      return { success: true };
    },
  };
}

function asReply(res: http.ServerResponse): MockReply {
  return {
    status: (code) => ({ send: (data) => writeJson(res, code, data) }),
    send: (data) => writeJson(res, 200, data),
  };
}

function writeJson(res: http.ServerResponse, code: number, data: unknown): void {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export function createTestControlHandler(nar: NAR) {
  const api = createTestControlApi(nar);

  return async function handleTestControl(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
  ): Promise<void> {
    const method = req.method ?? 'GET';
    const handlerName = ROUTES[pathname];
    const handler = handlerName ? api[handlerName] : undefined;
    if (!handler || (method !== 'GET' && method !== 'POST')) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    try {
      const body = await readJsonBody(req);
      const result = await handler({ body, method, url: pathname, headers: req.headers }, asReply(res));
      if (result !== undefined) writeJson(res, 200, result);
    } catch (e) {
      writeJson(res, 500, { error: String(e) });
    }
  };
}

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body ? JSON.parse(body) : {}));
  });
}

export type { NarAdapter };
