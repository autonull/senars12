import type http from 'http';
import type {NAR} from '../../../nar/src/nar.js';
import {setPendingChatResponse} from './gateway.js';

interface MockRequest {
    body: unknown;
    method: string;
    url: string;
    headers: http.IncomingHttpHeaders;
}

interface MockReply {
    status(code: number): { send(data: unknown): void };

    send(data: unknown): void;
}

type TestHandler = (req: MockRequest, reply: MockReply) => unknown | Promise<unknown>;

type HandlerKey = 'seedGraph' | 'injectChat' | 'injectDerivation' | 'getState' | 'reset';
const ROUTES: Record<string, HandlerKey> = {
    '/test/seed-graph': 'seedGraph',
    '/test/inject-chat': 'injectChat',
    '/test/inject-derivation': 'injectDerivation',
    '/test/state': 'getState',
    '/test/reset': 'reset',
};

interface SeedGraphBody {
    concepts: Array<{ term: string; f: number; c: number }>;
}

interface InjectChatBody {
    stream: string;
    complete: string;
}

interface InjectDerivationBody {
    conclusion: string;
    frequency?: number;
    confidence?: number;
}

function createTestControlApi(nar: NAR): Record<HandlerKey, TestHandler> {
    return {
        seedGraph: async ({body}) => {
            const {concepts} = body as SeedGraphBody;
            for (const c of concepts) await nar.believe(`${c.term}. %${c.f};${c.c}%`);
            return {success: true, count: concepts.length};
        },
        injectChat: ({body}) => {
            const {stream, complete} = body as InjectChatBody;
            setPendingChatResponse(stream, complete);
            return {success: true};
        },
        injectDerivation: async ({body}, reply) => {
            const {conclusion, frequency = 0.85, confidence = 0.9} = body as InjectDerivationBody;
            try {
                await nar.believe(`${conclusion}. %${frequency};${confidence}%`);
                return {success: true};
            } catch (e) {
                return reply.status(500).send({error: String(e)});
            }
        },
        getState: () => ({
            concepts: nar.listConcepts().map((c: any) => ({
                term: c.term.toString(),
                priority: c.priority,
                confidence: c.getBeliefs()[0]?.truth?.c ?? 0.9,
            })),
            workingMemory: [...nar.workingMemory.keys()] as string[],
        }),
        reset: async () => {
            nar.clearMemory();
            return {success: true};
        },
    };
}

function asReply(res: http.ServerResponse): MockReply {
    const sendJson = (code: number, data: unknown) => {
        res.writeHead(code, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(data));
    };
    return {
        status: (code: number) => ({send: (data: unknown) => sendJson(code, data)}),
        send: (data: unknown) => sendJson(200, data),
    };
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => resolve(body ? JSON.parse(body) : {}));
    });
}

export function createTestControlHandler(nar: NAR) {
    const api = createTestControlApi(nar);

    return async (
        req: http.IncomingMessage,
        res: http.ServerResponse,
        pathname: string
    ): Promise<void> => {
        const handlerKey = ROUTES[pathname];
        if (!handlerKey || (req.method !== 'GET' && req.method !== 'POST')) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }

        const handler = api[handlerKey];
        try {
            const body = await readJsonBody(req);
            const result = await handler(
                {body, method: req.method ?? 'GET', url: pathname, headers: req.headers},
                asReply(res)
            );
            if (result !== undefined) asReply(res).send(result);
        } catch (e) {
            asReply(res)
                .status(500)
                .send({error: String(e)});
        }
    };
}
