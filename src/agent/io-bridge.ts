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
    router.use(createErrorBoundary(logger));
    if (opts.auth) router.use(createAuthMiddleware(opts.auth));
    router.use(originExtractor);
    if (opts.commandRegistry) router.use(createCommandInterceptor(opts.commandRegistry));
    router.use(createRateLimiter(opts.rateLimitPerMinute ?? 30));
    router.use(createSessionBinder(opts.sessionManager));
    if (opts.enableNarseseHumanization && opts.generationService) {
        router.use(createNarseseOutputHumanization(opts.generationService));
    }
    router.use(createStreamingAgentDispatch(agent, logger));
    const traceNar = agent.getNAR();
    if (opts.enableNarsTrace !== false && traceNar) {
        router.use(createNarsTraceAnnotator(traceNar));
    }

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
