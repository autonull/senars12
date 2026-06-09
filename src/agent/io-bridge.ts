import type {Connection, IOMessage} from '../io/types.js';
import {MessageRouter, type MessageContext} from '../io/router.js';
import type {Agent} from './agent.js';
import type {AuthManager} from '../io/auth.js';
import type {CommandRegistry} from '../io/commands/registry.js';
import type {SessionManager} from './SessionManager.js';
import type {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import type {NAR} from '../nar/nar.js';
import {resolveReplyTarget} from '../io/connections/reply-target.js';
import type {NlBridge} from './nl-bridge.js';
import {
    originExtractor,
    createAuthMiddleware,
    createCommandInterceptor,
    createRateLimiter,
    createSessionBinder,
    createAgentDispatch,
    createNarsTraceAnnotator,
    createNlInputTranslation,
    createNarseseOutputHumanization,
} from './io-middleware.js';

export interface BridgeOptions {
    auth?: AuthManager;
    commandRegistry?: CommandRegistry;
    sessionManager: SessionManager;
    episodicMemory?: EpisodicMemory;
    rateLimitPerMinute?: number;
    nlBridge?: NlBridge;
    manager?: import('../io/connection-manager.js').ConnectionManager;
    enableNlTranslation?: boolean;
    enableNarseseHumanization?: boolean;
    enableNarsTrace?: boolean;
}

export function bindAgentToConnection(
    agent: Agent,
    connection: Connection,
    opts: BridgeOptions,
): () => void {
    const router = new MessageRouter();
    if (opts.auth) router.use(createAuthMiddleware(opts.auth));
    router.use(originExtractor);
    if (opts.commandRegistry) router.use(createCommandInterceptor(opts.commandRegistry));
    router.use(createRateLimiter(opts.rateLimitPerMinute ?? 30));
    router.use(createSessionBinder(opts.sessionManager));
    if (opts.enableNlTranslation && opts.nlBridge) {
        router.use(createNlInputTranslation(opts.nlBridge));
    }
    if (opts.enableNarseseHumanization && opts.nlBridge) {
        router.use(createNarseseOutputHumanization(opts.nlBridge));
    }
    router.use(createAgentDispatch(agent));
    if (opts.enableNarsTrace !== false && agent.getNAR()) {
        router.use(createNarsTraceAnnotator(agent.getNAR() as NAR));
    }

    const handler = (message: IOMessage) => {
        const context: MessageContext = {
            connection,
            nar: agent.getNAR() as NAR,
            respond: (text: string) => connection.send(resolveReplyTarget(connection, message), text),
            ...(opts.manager ? {manager: opts.manager} : {}),
        };
        return router.route(message, context);
    };
    connection.onMessage(handler);

    return () => {
        // Connection doesn't expose off() — caller should disconnect()
    };
}
