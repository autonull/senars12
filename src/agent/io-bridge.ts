import type {Connection, IOMessage} from '../io/types.js';
import {MessageRouter, type MessageContext} from '../io/router.js';
import type {Agent} from './agent.js';
import type {AuthManager} from '../io/auth.js';
import type {CommandRegistry} from '../io/commands/registry.js';
import type {ConnectionManager} from '../io/connection-manager.js';
import type {SessionManager} from './SessionManager.js';
import type {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {resolveReplyTarget} from '../io/connections/reply-target.js';
import type {NLGenerationService} from '../nar/nl/generation.js';
import {createLogger} from '../nar/logger/index.js';
import {
    createErrorBoundary,
    originExtractor,
    createAuthMiddleware,
    createCommandInterceptor,
    createRateLimiter,
    createSessionBinder,
    createStreamingAgentDispatch,
    createNarsTraceAnnotator,
    createNarseseOutputHumanization,
    compose,
} from './io-middleware.js';

export interface BridgeOptions {
    auth?: AuthManager;
    commandRegistry?: CommandRegistry;
    sessionManager: SessionManager;
    episodicMemory?: EpisodicMemory;
    rateLimitPerMinute?: number;
    generationService?: NLGenerationService;
    manager?: ConnectionManager;
    enableNarseseHumanization?: boolean;
    enableNarsTrace?: boolean;
    enableStreaming?: boolean;
}

export function bindAgentToConnection(
    agent: Agent,
    connection: Connection,
    opts: BridgeOptions,
): () => void {
    const router = new MessageRouter();
    const logger = createLogger({scope: `bridge:${connection.id}`});
    const traceNar = agent.getNAR();

    router.use(createErrorBoundary(logger));
    router.use(compose(
        opts.auth ? createAuthMiddleware(opts.auth) : async (m, c, next) => next(),
        originExtractor,
        opts.commandRegistry ? createCommandInterceptor(opts.commandRegistry) : async (m, c, next) => next(),
        createRateLimiter(opts.rateLimitPerMinute ?? 30),
        createSessionBinder(opts.sessionManager),
        opts.enableNarseseHumanization && opts.generationService ? createNarseseOutputHumanization(opts.generationService) : async (m, c, next) => next(),
        createStreamingAgentDispatch(agent, logger),
        opts.enableNarsTrace !== false && traceNar ? createNarsTraceAnnotator(traceNar) : async (m, c, next) => next()
    ));

    const handler = (message: IOMessage) => {
        const nar = agent.getNAR();
        const context: MessageContext = {
            connection,
            ...(nar ? {nar} : {}),
            respond: (text: string) => connection.send(resolveReplyTarget(connection, message), text),
            ...(opts.manager ? {manager: opts.manager} : {}),
        };
        return router.route(message, context);
    };
    connection.onMessage(handler);

    return () => {
        connection.removeMessageHandler?.(handler);
    };
}
