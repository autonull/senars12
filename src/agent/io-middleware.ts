import type {MessageMiddleware, MessageContext} from '../io/router.js';
import type {IOMessage} from '../io/types.js';
import type {AuthManager} from '../io/auth.js';
import type {CommandContext, CommandRegistry} from '../io/commands/registry.js';
import type {NAR} from '../nar/nar.js';
import type {ConnectionManager} from '../io/connection-manager.js';
import type {SessionManager} from './SessionManager.js';
import type {ConversationSession} from './ConversationSession.js';
import type {Agent} from './agent.js';
import type {NlBridge} from './nl-bridge.js';
import {appendTurn} from './ConversationSession.js';

export interface BridgeContext extends MessageContext {
    sessionKey?: string;
    session?: ConversationSession;
    manager?: ConnectionManager;
}

const NARSESE_OUTPUT_RE = /[(<{}\[].*?[)>}\]]/;

export function originExtractor(message: IOMessage, context: MessageContext, next: () => Promise<void>): Promise<void> {
    (context as BridgeContext).sessionKey = message.origin;
    return next();
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
        if (!text.startsWith('/')) {
            await next();
            return;
        }

        const parts = text.slice(1).split(/\s+/);
        const cmd = parts[0] ?? '';
        const args = parts.slice(1);
        const bridgeCtx = context as BridgeContext;
        const commandContext: CommandContext = {
            nar: context.nar,
            connection: context.connection,
            manager: bridgeCtx.manager ?? ({} as ConnectionManager),
        };
        try {
            const result = await registry.execute(cmd, args, commandContext);
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
        const key = bridgeCtx.sessionKey ?? message.origin;
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
        const key = bridgeCtx.sessionKey ?? message.origin;
        const session = manager.getOrCreate(key);
        bridgeCtx.session = session;
        await next();
    };
}

export function createAgentDispatch(agent: Agent): MessageMiddleware {
    return async (message, context, next) => {
        const bridgeCtx = context as BridgeContext;
        const reply = bridgeCtx.session
            ? await agent.chatWithHistory(message.text, bridgeCtx.session)
            : await agent.chat(message.text);
        await context.respond(reply);
    };
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
        const {termParser} = await import('../nar/terms/index.js');
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

        const {result} = translation;
        const tasks: Array<Promise<unknown>> = [];
        for (const belief of result.beliefs ?? []) {
            tasks.push(context.nar.believe(belief.narsese, belief.truth));
        }
        for (const question of result.questions ?? []) {
            tasks.push(context.nar.question(question));
        }
        for (const goal of result.goals ?? []) {
            tasks.push(context.nar.goal(goal));
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
