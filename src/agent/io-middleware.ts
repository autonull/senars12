import type {MessageMiddleware, MessageContext} from '../io/router.js';
import type {IOMessage, Logger} from '../io/types.js';
import type {AuthManager} from '../io/auth.js';
import type {CommandContext, CommandRegistry} from '../io/commands/registry.js';
import type {NAR} from '../nar/nar.js';
import type {ConnectionManager} from '../io/connection-manager.js';
import type {SessionManager} from './SessionManager.js';
import type {ConversationSession} from './ConversationSession.js';
import type {Agent} from './agent.js';
import type {NlBridge} from './nl-bridge.js';
import {termParser} from '../nar/terms/index.js';
import {appendTurn} from './ConversationSession.js';
import {EpisodeWorkingMemory} from './EpisodeWorkingMemory.js';

/**
 * Mutable runtime context extending MessageContext.
 *
 * Properties inherited from MessageContext are re-declared without `readonly`
 * so middleware can attach session/binding state mid-pipeline. If MessageContext
 * gains new fields, add them here too to keep the mutable variant in sync.
 */
export interface BridgeContext extends MessageContext {
    sessionKey?: string;
    session?: ConversationSession;
    manager?: ConnectionManager;
    workingMemory?: EpisodeWorkingMemory;
}

const NARSESE_OUTPUT_RE = /[(<{}\[].*?[)>}\]]/;

export function resolveSessionKey(message: IOMessage): string {
    return message.origin;
}

export function originExtractor(message: IOMessage, context: MessageContext, next: () => Promise<void>): Promise<void> {
    (context as BridgeContext).sessionKey = resolveSessionKey(message);
    return next();
}

export function createErrorBoundary(logger: Logger): MessageMiddleware {
    return async (message, context, next) => {
        try {
            await next();
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            logger.error('middleware pipeline error', err, {
                connection: context.connection.id,
                origin: message.origin,
                sender: message.sender,
            });
            try {
                await context.respond(`Error: ${err.message}`);
            } catch (respondErr) {
                logger.error('failed to send error response', respondErr as Error, {
                    connection: context.connection.id,
                });
            }
        }
    };
}

export function createAuthMiddleware(auth: AuthManager): MessageMiddleware {
    return async (message, context, next) => {
        const connId = context.connection.id;
        const result = auth.checkAuth(connId, message.sender, message.text);
        if (result === 'ignore') return;
        if (result === 'auth_bound') {
            auth.bindUser(connId, message.sender);
            await context.respond(`Authenticated as ${message.sender}.`);
            return;
        }
        await next();
    };
}

export function createCommandInterceptor(registry: CommandRegistry): MessageMiddleware {
    return async (message, context, next) => {
        const text = message.text.trim();
        if (!text.startsWith('/') && !text.startsWith('.')) {
            await next();
            return;
        }

        const parts = text.slice(1).split(/\s+/);
        const cmd = parts[0] ?? '';
        const args = parts.slice(1);
        const bridgeCtx = context as BridgeContext;
        const commandContext: CommandContext = {
            connection: context.connection,
            ...(context.nar ? {nar: context.nar} : {}),
            ...(bridgeCtx.manager ? {manager: bridgeCtx.manager} : {}),
        };
        try {
            let result: string;
            try {
                result = await registry.execute(cmd, args, commandContext);
            } catch (bareErr) {
                // Support commands registered with leading "/" or "." (e.g. "/help")
                if (bareErr instanceof Error && bareErr.message.startsWith('Unknown command')) {
                    result = await registry.execute(`/${cmd}`, args, commandContext);
                } else {
                    throw bareErr;
                }
            }
            if (result === '__CLI_QUIT__') {
                await context.respond('Goodbye!');
                await context.connection.disconnect('quit');
                return;
            }
            await context.respond(result);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            await context.respond(`Error: ${msg}`);
        }
    };
}

export function createRateLimiter(perMinute: number): MessageMiddleware {
    const buckets = new Map<string, {tokens: number; lastRefill: number}>();
    const refillRate = perMinute / 60_000;
    return async (message, context, next) => {
        const bridgeCtx = context as BridgeContext;
        const key = bridgeCtx.sessionKey ?? resolveSessionKey(message);
        const now = Date.now();
        let bucket = buckets.get(key);
        if (!bucket) {
            bucket = {tokens: perMinute, lastRefill: now};
            buckets.set(key, bucket);
        }
        const elapsed = now - bucket.lastRefill;
        bucket.tokens = Math.min(perMinute, bucket.tokens + elapsed * refillRate);
        bucket.lastRefill = now;
        if (bucket.tokens < 1) {
            await context.respond('Rate limit exceeded. Slow down.');
            return;
        }
        bucket.tokens -= 1;
        await next();
    };
}

export function createSessionBinder(manager: SessionManager): MessageMiddleware {
    return async (message, context, next) => {
        const bridgeCtx = context as BridgeContext;
        const key = bridgeCtx.sessionKey ?? resolveSessionKey(message);
        const session = manager.getOrCreate(key);
        bridgeCtx.session = session;
        await next();
    };
}

export function createAgentDispatch(agent: Agent): MessageMiddleware {
    return async (message, context, next) => {
        const bridgeCtx = context as BridgeContext;
        const reply = bridgeCtx.session
            ? await agent.chatWithHistory(message.text, bridgeCtx.session, {
                ...(bridgeCtx.workingMemory ? {workingMemory: bridgeCtx.workingMemory} : {}),
            })
            : await agent.chat(message.text, {
                ...(bridgeCtx.workingMemory ? {workingMemory: bridgeCtx.workingMemory} : {}),
            });
        await context.respond(reply);
    };
}

interface DispatchState {
    controller: AbortController;
    workingMemory: EpisodeWorkingMemory;
}

const sessionStates = new WeakMap<ConversationSession, DispatchState>();

const getSessionState = (session: ConversationSession): DispatchState => {
    let state = sessionStates.get(session);
    if (!state) {
        state = {
            controller: new AbortController(),
            workingMemory: new EpisodeWorkingMemory(),
        };
        sessionStates.set(session, state);
    }
    return state;
};

export function createStreamingAgentDispatch(agent: Agent, logger: Logger, opts: {humanizeTools?: boolean} = {}): MessageMiddleware {
    const humanize = opts.humanizeTools ?? true;
    return async (message, context, next) => {
        const bridgeCtx = context as BridgeContext;
        const session = bridgeCtx.session;

        const state = session ? getSessionState(session) : {
            controller: new AbortController(),
            workingMemory: new EpisodeWorkingMemory(),
        };

        if (session) bridgeCtx.workingMemory = state.workingMemory;

        const previous = state.controller;
        const nextController = new AbortController();
        state.controller = nextController;
        previous.abort();

        const respondText = context.respond;
        let streamedText = '';

        try {
            const iter = agent.chatStream(message.text, session, {
                signal: nextController.signal,
                ...(session ? {workingMemory: state.workingMemory} : {workingMemory: state.workingMemory}),
            });
            let nextEvent = await iter.next();
            while (!nextEvent.done) {
                const ev = nextEvent.value;
                if (ev.kind === 'text-delta' && ev.text) {
                    streamedText += ev.text;
                    await respondText(ev.text);
                } else if (ev.kind === 'tool-call' && humanize && ev.toolName) {
                    const note = humanizeToolCall(ev.toolName, ev.toolArgs);
                    if (note) await respondText(note);
                } else if (ev.kind === 'tool-result' && humanize && ev.toolName) {
                    const note = humanizeToolResult(ev.toolName, ev.toolArgs, ev.toolResult);
                    if (note) await respondText(note);
                } else if (ev.kind === 'error') {
                    logger.warn('chatStream emitted error event', {error: ev.error});
                } else if (ev.kind === 'aborted') {
                    logger.debug('chatStream aborted by signal', {sessionKey: session?.key});
                }
                nextEvent = await iter.next();
            }
            const finalText = nextEvent.value || streamedText;
            if (session && !streamedText) {
                await respondText(finalText);
            }
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            logger.error('streaming dispatch error', err, {sessionKey: session?.key});
            try {
                await respondText(`Error: ${err.message}`);
            } catch (respondErr) {
                logger.error('failed to send error response', respondErr as Error, {sessionKey: session?.key});
            }
        }
    };
}

function humanizeToolCall(name: string, args?: Record<string, unknown>): string | undefined {
    if (!args) return undefined;
    if (name === 'nar_believe' && typeof args.statement === 'string') {
        return `_(storing: ${args.statement})_\n`;
    }
    if (name === 'nar_query' && typeof args.term === 'string') {
        return `_(querying: ${args.term})_\n`;
    }
    if (name === 'calculate' && typeof args.expression === 'string') {
        return `_(calculating: ${args.expression})_\n`;
    }
    if (name === 'know' && typeof args.key === 'string') {
        return `_(remembering: ${args.key})_\n`;
    }
    return undefined;
}

function humanizeToolResult(name: string, args?: Record<string, unknown>, result?: unknown): string | undefined {
    if (!result || typeof result !== 'object') return undefined;
    const r = result as Record<string, unknown>;
    if (name === 'calculate' && 'result' in r && typeof r.result === 'number') {
        return `_\`${args?.expression ?? '?'}\` = ${r.result}_\n`;
    }
    if (name === 'nar_believe' && r.success && typeof args?.statement === 'string') {
        return `_\u2713 stored: ${args.statement}_\n`;
    }
    if (name === 'know' && r.stored === true && typeof args?.key === 'string') {
        return `_\u2713 stored: ${args.key}_\n`;
    }
    return undefined;
}

export function abortSession(session: ConversationSession): void {
    const state = sessionStates.get(session);
    state?.controller.abort();
}

export function clearSessionState(session: ConversationSession): void {
    const state = sessionStates.get(session);
    state?.controller.abort();
    sessionStates.delete(session);
}

export function createNarsTraceAnnotator(nar: NAR): MessageMiddleware {
    let lastAttention = new Set<string>();
    return async (_message, context, next) => {
        await next();
        const report = nar.attentionReport();
        const newTerms = report.concepts
            .filter(c => !lastAttention.has(c.term))
            .slice(0, 5)
            .map(c => c.term);
        if (newTerms.length > 0) {
            const bridgeCtx = context as BridgeContext;
            const session = bridgeCtx.session;
            if (session && session.history.length > 0) {
                const last = session.history[session.history.length - 1];
                if (last && last.role === 'assistant') {
                    last.content = `${last.content}\n[NARS: derived ${newTerms.join(', ')}]`;
                    last.metadata = {...(last.metadata ?? {}), trace: newTerms};
                }
            }
            lastAttention = new Set(report.concepts.map(c => c.term));
        }
    };
}

export function createNlInputTranslation(nlBridge: NlBridge): MessageMiddleware {
    return async (message, context, next) => {
        const text = message.text;
        if (termParser.parseTask(text) !== null) {
            await next();
            return;
        }

        const translation = await nlBridge.nlToNarsese(text);
        if (translation.kind === 'none') {
            await next();
            return;
        }
        if (translation.kind === 'clarify') {
            await context.respond(translation.question);
            return;
        }

        const nar = context.nar;
        if (!nar) {
            await next();
            return;
        }

        const {result} = translation;
        const tasks: Array<Promise<unknown>> = [];
        for (const belief of result.beliefs ?? []) {
            tasks.push(nar.believe(belief.narsese, belief.truth));
        }
        for (const question of result.questions ?? []) {
            tasks.push(nar.question(question));
        }
        for (const goal of result.goals ?? []) {
            tasks.push(nar.goal(goal));
        }
        await Promise.all(tasks);

        const lines: string[] = [];
        for (const belief of result.beliefs ?? []) {
            lines.push(`+ ${belief.narsese}`);
        }
        for (const question of result.questions ?? []) {
            lines.push(`? ${question}`);
        }
        for (const goal of result.goals ?? []) {
            lines.push(`! ${goal}`);
        }
        const response = lines.length > 0
            ? lines.join('\n') + (result.summary ? `\n\n(${result.summary})` : '')
            : result.summary || 'Translation produced no Narsese operations.';

        const bridgeCtx = context as BridgeContext;
        if (bridgeCtx.session) {
            appendTurn(bridgeCtx.session, 'user', text);
            appendTurn(bridgeCtx.session, 'assistant', response, {translated: true});
        }
        await context.respond(response);
    };
}

export function createNarseseOutputHumanization(nlBridge: NlBridge): MessageMiddleware {
    return async (_message, context, next) => {
        const bridgeCtx = context as BridgeContext;
        if (!bridgeCtx.session) {
            await next();
            return;
        }
        const sessionRef: ConversationSession = bridgeCtx.session;
        const originalRespond = context.respond;
        (context as {respond: typeof originalRespond}).respond = async (text: string) => {
            let toSend = text;
            if (NARSESE_OUTPUT_RE.test(text)) {
                const humanized = nlBridge.interpretDerivation(null, text);
                if (humanized && humanized !== text) {
                    toSend = humanized;
                    for (let i = sessionRef.history.length - 1; i >= 0; i--) {
                        const m = sessionRef.history[i];
                        if (m && m.role === 'assistant') {
                            m.content = humanized;
                            m.metadata = {...(m.metadata ?? {}), narsese: text, humanized: true};
                            break;
                        }
                    }
                }
            }
            return originalRespond(toSend);
        };
        try {
            await next();
        } finally {
            (context as {respond: typeof originalRespond}).respond = originalRespond;
        }
    };
}
