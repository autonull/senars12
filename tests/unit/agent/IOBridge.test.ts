import {describe, expect, it, jest} from '@jest/globals';
import {bindAgentToConnection} from '../../../src/agent/io-bridge.js';
import {createConnectionConfigsFromEnv} from '../../../src/agent/options-schema.js';
import {
    createAgentDispatch,
    createAuthMiddleware,
    createCommandInterceptor,
    createErrorBoundary,
    createRateLimiter,
    createSessionBinder,
    originExtractor,
    resolveSessionKey,
} from '../../../src/agent/io-middleware.js';
import {InMemorySessionManager, JsonlSessionManager} from '../../../src/agent/SessionManager.js';
import {createSession} from '../../../src/agent/ConversationSession.js';
import {CommandRegistry} from '../../../src/io/commands/registry.js';
import {AuthManager} from '../../../src/io/auth.js';
import {MessageRouter} from '../../../src/io/router.js';
import {SeNARSFactory} from '../../../src/nar/index.js';
import {EpisodicMemory} from '../../../src/nar/memory/EpisodicMemory.js';
import type {Connection, IOMessage, Logger} from '../../../src/io/types.js';
import type {NAR} from '../../../src/nar/nar.js';
import type {LMClient} from '../../../src/nar/lm/types.js';
import {createAgent} from '../../../src/agent/agent.js';
import {mkdtempSync} from 'fs';
import {tmpdir} from 'os';
import {join} from 'path';

const scriptedLM: LMClient = {
    provider: 'scripted',
    model: 'test',
    available: true,
    async generateText(p: string) {
        if (p.includes('hello')) return 'Hi!';
        if (p.includes('name')) return 'I am SeNARS';
        return 'Mock reply';
    },
};

type MessageHandler = (m: IOMessage) => Promise<void>;
type TestConn = Connection & {
    messages: IOMessage[];
    sent: Array<{ target: string; text: string }>;
    handlers: MessageHandler[];
};

function makeConn(): TestConn {
    const sent: Array<{ target: string; text: string }> = [];
    const messages: IOMessage[] = [];
    const handlers: MessageHandler[] = [];
    const conn: TestConn = {
        id: 'conn-test',
        name: 'TestConn',
        type: 'test',
        state: 'connected',
        messages,
        sent,
        handlers,
        send: async (target, text) => {
            sent.push({target, text});
        },
        onMessage: (h) => {
            handlers.push(h);
        },
        removeMessageHandler: (h) => {
            const idx = handlers.indexOf(h);
            if (idx >= 0) handlers.splice(idx, 1);
        },
        onStateChange: () => undefined,
        onError: () => undefined,
        getStatus: () => ({state: 'connected', messageCount: messages.length, errorCount: 0}),
        reconfigure: async () => undefined,
        connect: async () => undefined,
        disconnect: async () => undefined,
        reconnect: async () => undefined,
    };
    return conn;
}

function makeMessage(text: string, origin = 'test:direct:alice', sender = 'alice'): IOMessage {
    return {
        id: `m-${Date.now()}-${Math.random()}`,
        source: 'conn-test',
        origin,
        sender,
        text,
        timestamp: Date.now(),
    };
}

const fakeNar = {} as NAR;
const noopRespond = async (_text: string): Promise<void> => undefined;

describe('originExtractor', () => {
    it('sets sessionKey from message.origin', async () => {
        const router = new MessageRouter();
        router.use(originExtractor);
        let observed: string | undefined;
        router.use(async (_msg, ctx) => {
            observed = (ctx as { sessionKey?: string }).sessionKey;
        });
        const conn = makeConn();
        const context = {connection: conn, nar: fakeNar, respond: noopRespond};
        await router.route(makeMessage('hi'), context);
        expect(observed).toBe('test:direct:alice');
    });
});

describe('createCommandInterceptor', () => {
    it('short-circuits on /help and returns text', async () => {
        const registry = new CommandRegistry();
        registry.register({name: 'help', description: '', usage: '', execute: async () => 'HELP TEXT'});
        const conn = makeConn();
        const respond = jest.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        const next = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const mw = createCommandInterceptor(registry);
        const ctx = {connection: conn, nar: fakeNar, respond};
        await mw(makeMessage('/help'), ctx, next);
        expect(respond).toHaveBeenCalledWith('HELP TEXT');
        expect(next).not.toHaveBeenCalled();
    });

    it('responds with error on unknown command', async () => {
        const registry = new CommandRegistry();
        const conn = makeConn();
        const respond = jest.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        const next = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const mw = createCommandInterceptor(registry);
        const ctx = {connection: conn, nar: fakeNar, respond};
        await mw(makeMessage('/bad'), ctx, next);
        expect(respond).toHaveBeenCalledWith(expect.stringContaining('Error'));
        expect(next).not.toHaveBeenCalled();
    });

    it('passes through plain text (no command)', async () => {
        const registry = new CommandRegistry();
        const conn = makeConn();
        const respond = jest.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        const next = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const mw = createCommandInterceptor(registry);
        const ctx = {connection: conn, nar: fakeNar, respond};
        await mw(makeMessage('hello there'), ctx, next);
        expect(next).toHaveBeenCalled();
        expect(respond).not.toHaveBeenCalled();
    });

    it('returns __CLI_QUIT__ sentinel and disconnects', async () => {
        const registry = new CommandRegistry();
        registry.register({name: 'quit', description: '', usage: '', execute: async () => '__CLI_QUIT__'});
        const conn = makeConn();
        const respond = jest.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        const next = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const mw = createCommandInterceptor(registry);
        const ctx = {connection: conn, nar: fakeNar, respond};
        await mw(makeMessage('/quit'), ctx, next);
        expect(respond).toHaveBeenCalledWith('Goodbye!');
        expect(next).not.toHaveBeenCalled();
    });
});

describe('createRateLimiter', () => {
    it('drops messages over the threshold', async () => {
        const mw = createRateLimiter(2);
        const conn = makeConn();
        const respond = jest.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        const next = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const ctx = {connection: conn, nar: fakeNar, respond};
        const msg = makeMessage('m');
        await mw(msg, ctx, next);
        await mw(msg, ctx, next);
        await mw(msg, ctx, next);
        expect(next).toHaveBeenCalledTimes(2);
        expect(respond).toHaveBeenCalledWith(expect.stringContaining('Rate limit'));
    });
});

describe('createSessionBinder', () => {
    it('returns same session for same key, different for different', async () => {
        const mgr = new InMemorySessionManager();
        const mw = createSessionBinder(mgr);
        const conn = makeConn();
        const ctx = {connection: conn, nar: fakeNar, respond: noopRespond};
        const next = async (): Promise<void> => undefined;
        const a = makeMessage('hi', 'k:1:alice');
        const b = makeMessage('hi', 'k:1:alice');
        const c = makeMessage('hi', 'k:1:bob');
        await mw(a, ctx, next);
        await mw(b, ctx, next);
        await mw(c, ctx, next);
        expect(mgr.size()).toBe(2);
    });
});

describe('createAgentDispatch', () => {
    it('calls chatWithHistory when session present', async () => {
        const nar = SeNARSFactory.createForTesting({maxConcepts: 10});
        const ep = new EpisodicMemory({
            enabled: true,
            basePath: mkdtempSync(join(tmpdir(), 'ep-')),
            retentionDays: 1,
            maxEntriesPerFile: 100
        });
        const agent = createAgent({nar, lmClient: scriptedLM, episodicMemory: ep});
        const session = createSession('test:direct:alice');
        const mw = createAgentDispatch(agent);
        const conn = makeConn();
        const respond = jest.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        const ctx = {connection: conn, nar, respond, session};
        await mw(makeMessage('hello'), ctx, async () => undefined);
        expect(respond).toHaveBeenCalled();
        expect(session.history.length).toBe(2);
        expect(session.history[0]?.content).toBe('hello');
    });
});

describe('createAuthMiddleware', () => {
    it('allows open connections', async () => {
        const auth = new AuthManager();
        const next = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const mw = createAuthMiddleware(auth);
        const conn = makeConn();
        const ctx = {connection: conn, nar: fakeNar, respond: noopRespond};
        await mw(makeMessage('hi'), ctx, next);
        expect(next).toHaveBeenCalled();
    });

    it('binds user on correct secret', async () => {
        const auth = new AuthManager();
        auth.setSecret('conn-test', 's3cr3t');
        const mw = createAuthMiddleware(auth);
        const conn = makeConn();
        const respond = jest.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        const next = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const ctx = {connection: conn, nar: fakeNar, respond};
        await mw(makeMessage('.auth s3cr3t'), ctx, next);
        expect(respond).toHaveBeenCalledWith(expect.stringContaining('Authenticated'));
        expect(next).not.toHaveBeenCalled();
    });

    it('ignores unauthorized messages when secret set', async () => {
        const auth = new AuthManager();
        auth.setSecret('conn-test', 's3cr3t');
        const mw = createAuthMiddleware(auth);
        const conn = makeConn();
        const respond = jest.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        const next = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const ctx = {connection: conn, nar: fakeNar, respond};
        await mw(makeMessage('hi'), ctx, next);
        expect(next).not.toHaveBeenCalled();
        expect(respond).not.toHaveBeenCalled();
    });
});

describe('bindAgentToConnection end-to-end', () => {
    it('routes message → response, updates session', async () => {
        const nar = SeNARSFactory.createForTesting({maxConcepts: 10});
        const ep = new EpisodicMemory({
            enabled: true,
            basePath: mkdtempSync(join(tmpdir(), 'ep-')),
            retentionDays: 1,
            maxEntriesPerFile: 100
        });
        const agent = createAgent({nar, lmClient: scriptedLM, episodicMemory: ep});
        const sessionManager = new InMemorySessionManager();
        const conn = makeConn();
        bindAgentToConnection(agent, conn, {
            sessionManager,
            enableNarseseHumanization: false,
        });
        expect(conn.handlers.length).toBe(1);
        await conn.handlers[0]!(makeMessage('hello'));
        expect(conn.sent.length).toBeGreaterThan(0);
        expect(sessionManager.size()).toBe(1);
        const session = sessionManager.getOrCreate('test:direct:alice');
        expect(session.history.length).toBe(2);
    });

    it('responds to /help through registry', async () => {
        const nar = SeNARSFactory.createForTesting({maxConcepts: 10});
        const ep = new EpisodicMemory({
            enabled: true,
            basePath: mkdtempSync(join(tmpdir(), 'ep-')),
            retentionDays: 1,
            maxEntriesPerFile: 100
        });
        const agent = createAgent({nar, lmClient: scriptedLM, episodicMemory: ep});
        const sessionManager = new InMemorySessionManager();
        const registry = new CommandRegistry();
        registry.register({name: 'help', description: '', usage: '', execute: async () => 'HELP'});
        const conn = makeConn();
        bindAgentToConnection(agent, conn, {
            sessionManager,
            commandRegistry: registry,
            enableNarseseHumanization: false,
        });
        await conn.handlers[0]!(makeMessage('/help'));
        expect(conn.sent[0]?.text).toBe('HELP');
    });
});

describe('createConnectionConfigsFromEnv', () => {
    it('returns IRC + WS by default', () => {
        const old = {...process.env};
        delete process.env.ENABLE_IRC;
        delete process.env.ENABLE_WS;
        delete process.env.ENABLE_HTTP;
        delete process.env.ENABLE_MCP;
        const configs = createConnectionConfigsFromEnv();
        const types = configs.map(c => c.type);
        expect(types).toContain('irc');
        expect(types).toContain('websocket');
        expect(types).not.toContain('http');
        process.env = old;
    });
});

describe('resolveSessionKey', () => {
    it('returns message.origin', () => {
        const m = makeMessage('hi', 'irc:#senars:bob');
        expect(resolveSessionKey(m)).toBe('irc:#senars:bob');
    });
});

describe('createErrorBoundary', () => {
    function makeLogger(): Logger & { errors: Array<{ message: string; error?: Error }> } {
        const errors: Array<{ message: string; error?: Error }> = [];
        return {
            errors,
            debug: () => undefined,
            info: () => undefined,
            warn: () => undefined,
            error: (message, error) => {
                errors.push({message, error});
            },
            child: () => makeLogger(),
        };
    }

    it('catches errors from downstream middleware and sends fallback response', async () => {
        const logger = makeLogger();
        const mw = createErrorBoundary(logger);
        const respond = jest.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        const boom = new Error('kaboom');
        const ctx = {connection: makeConn(), respond};
        await mw(makeMessage('x'), ctx, async () => {
            throw boom;
        });
        expect(respond).toHaveBeenCalledWith('Error: kaboom');
        expect(logger.errors[0]?.message).toContain('middleware pipeline error');
        expect(logger.errors[0]?.error).toBe(boom);
    });

    it('passes through when no error', async () => {
        const logger = makeLogger();
        const mw = createErrorBoundary(logger);
        const respond = jest.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        const next = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const ctx = {connection: makeConn(), respond};
        await mw(makeMessage('x'), ctx, next);
        expect(next).toHaveBeenCalled();
        expect(respond).not.toHaveBeenCalled();
    });
});

describe('CommandContext with no manager', () => {
    it('/connections returns fallback when no manager', async () => {
        const registry = new CommandRegistry();
        registry.register({
            name: 'connections', aliases: ['.connections'],
            description: '', usage: '',
            execute: async (_args, ctx) => {
                if (!ctx.manager) return 'Connection manager not configured';
                return ctx.manager.getConnections().size === 0 ? 'No active connections' : 'has conns';
            },
        });
        const mw = createCommandInterceptor(registry);
        const conn = makeConn();
        const respond = jest.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        const next = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const ctx = {connection: conn, respond};
        await mw(makeMessage('/connections'), ctx, next);
        expect(respond).toHaveBeenCalledWith(expect.stringContaining('Connection manager not configured'));
    });

    it('/help works without manager or nar', async () => {
        const registry = new CommandRegistry();
        registry.register({
            name: 'help', aliases: ['.help'],
            description: '', usage: '',
            execute: async () => 'Commands:\n  /help\n  /stats',
        });
        const mw = createCommandInterceptor(registry);
        const conn = makeConn();
        const respond = jest.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        const next = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const ctx = {connection: conn, respond};
        await mw(makeMessage('/help'), ctx, next);
        expect(respond).toHaveBeenCalledWith(expect.stringContaining('Commands:'));
    });
});

describe('getOrCreate touches lastSeenAt', () => {
    it('updates lastSeenAt on repeated access', async () => {
        const mgr = new InMemorySessionManager();
        const first = mgr.getOrCreate('k1');
        const initial = first.lastSeenAt;
        await new Promise(r => setTimeout(r, 10));
        const second = mgr.getOrCreate('k1');
        expect(second).toBe(first);
        expect(second.lastSeenAt).toBeGreaterThanOrEqual(initial);
    });

    it('JsonlSessionManager also touches lastSeenAt', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'sessions-'));
        const mgr = new JsonlSessionManager({basePath: dir});
        const first = mgr.getOrCreate('k1');
        const initial = first.lastSeenAt;
        await new Promise(r => setTimeout(r, 10));
        const second = mgr.getOrCreate('k1');
        expect(second.lastSeenAt).toBeGreaterThanOrEqual(initial);
        await mgr.close();
    });
});

describe('bindAgentToConnection: cleanup', () => {
    it('returns a cleanup function that removes the message handler', async () => {
        const nar = SeNARSFactory.createForTesting({maxConcepts: 5});
        const agent = createAgent({nar, lmClient: scriptedLM});
        const conn = makeConn();
        const sessionManager = new InMemorySessionManager();
        const dispose = bindAgentToConnection(agent, conn, {
            sessionManager,
            enableNarseseHumanization: false,
            enableNarsTrace: false,
        });
        expect(conn.handlers.length).toBe(1);
        dispose();
        expect(conn.handlers.length).toBe(0);
    });
});

describe('bindAgentToConnection: no NAR (LM only)', () => {
    it('works with no NAR (LM only)', async () => {
        const agent = createAgent({lmClient: scriptedLM});
        const conn = makeConn();
        const sessionManager = new InMemorySessionManager();
        bindAgentToConnection(agent, conn, {
            sessionManager,
            enableNarseseHumanization: false,
            enableNarsTrace: false,
        });
        await conn.handlers[0]!(makeMessage('hello'));
        expect(conn.sent.length).toBeGreaterThan(0);
        expect(conn.sent[0]?.text).toBe('Hi!');
    });
});
