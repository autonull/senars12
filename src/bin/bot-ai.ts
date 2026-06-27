#!/usr/bin/env tsx
/**
 * SeNARS Bot - Multi-connection agent.
 *
 * Default config: connects to irc.libera.chat#senars as `senars-bot`
 * and starts a WebSocket server on 8765. Set ENABLE_HTTP=true or
 * ENABLE_MCP=true to opt in to additional transports.
 */

import {
    agentConfigToOptions,
    bindAgentToConnection,
    createAgent,
    createAutonomyEngine,
    createConnectionConfigsFromEnv,
    JsonlSessionManager,
    registerAllCommands
} from '../agent';
import {
    AuthManager,
    CLIConnection,
    CommandRegistry,
    ConnectionManager,
    HTTPConnection,
    IRCConnection,
    MCPConnection,
    WSConnection
} from '../io';
import {NLGenerationService, NLUnderstandingService} from '../nar/nl';
import {SeNARSFactory} from '../nar';
import {createSeNARSRegistry, getModelForTask} from '../nar/lm';
import {resolveLMConfig} from '../nar/lm/env-config.js';
import {createLogger} from '../nar/logger';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {TranslationCache} from '../nar/nl/cache.js';
import {DEFAULT_NAR_CONFIG, loadConfigFromEnv} from '../config';
import {setupGracefulShutdown} from '../utils';
import {assertValidEnv} from '../utils/env-validate.js';
import {mkdir} from 'node:fs/promises';

assertValidEnv();

const logger = createLogger({scope: 'bot'});

async function main(): Promise<void> {
    const config = await loadConfigFromEnv();

    const registry = createSeNARSRegistry();
    const lmConfig = resolveLMConfig();
    const nar = SeNARSFactory.createDefault({
        ...DEFAULT_NAR_CONFIG,
        providerRegistry: registry,
    });

    const episodicMemory = new EpisodicMemory({
        enabled: true,
        maxEntriesPerFile: 100,
        basePath: process.env.EPISODIC_MEMORY_PATH || '.cache/episodes',
        retentionDays: parseInt(process.env.EPISODIC_RETENTION_DAYS || '30'),
    });

    const systemEventBus = nar.getSystemEventBus();
    const autonomyEngine = createAutonomyEngine(nar, systemEventBus);
    autonomyEngine.setNotifyHandler((msg) => logger.debug(`[Autonomy] ${msg}`));

    const externalTools = {
        webSearch: {apiKey: process.env.BRAVE_API_KEY ?? process.env.TAVILY_API_KEY},
        codeExec: {maxTimeout: 10000, maxOutputBytes: 1024 * 1024},
        fs: {maxReadSize: 1024 * 1024},
    };

    const agent = createAgent({
        nar,
        episodicMemory,
        autonomyEngine,
        externalTools,
        workspaceRoot: process.cwd(),
        ...agentConfigToOptions(config.agent)
    });

    await mkdir('.cache/sessions', {recursive: true}).catch(() => undefined);
    const sessionManager = new JsonlSessionManager({basePath: '.cache/sessions'});
    await sessionManager.restore();

    const auth = new AuthManager();
    if (process.env.AUTH_SECRET) {
        for (const connId of (process.env.AUTH_CONNECTION_IDS ?? 'irc-main,http-main,ws-main').split(',')) {
            auth.setSecret(connId.trim(), process.env.AUTH_SECRET);
        }
    }

    const commandRegistry = new CommandRegistry();
    registerAllCommands(commandRegistry);

    const translationCache = new TranslationCache({basePath: '.cache/translation-cache'});
    const generationService = new NLGenerationService(registry);
    const understandingService = new NLUnderstandingService(registry, translationCache, {structuredOnly: true});

    const cm = new ConnectionManager(logger);
    cm.registerFactory({type: 'cli', create: cfg => new CLIConnection(cfg, {nar, emit: () => undefined, logger})});
    cm.registerFactory({type: 'irc', create: cfg => new IRCConnection(cfg, {nar, emit: () => undefined, logger})});
    cm.registerFactory({type: 'websocket', create: cfg => new WSConnection(cfg, {nar, emit: () => undefined, logger})});
    cm.registerFactory({type: 'http', create: cfg => new HTTPConnection(cfg, {nar, emit: () => undefined, logger})});
    cm.registerFactory({type: 'mcp', create: cfg => new MCPConnection(cfg, {nar, emit: () => undefined, logger})});

    const configs = createConnectionConfigsFromEnv();
    logger.info(`Configured connections: ${configs.map((c: {
        type: string;
        id: string
    }) => `${c.type}:${c.id}`).join(', ') || '(none)'}`);

    for (const cfg of configs) {
        try {
            const conn = await cm.addConnection(cfg, {nar, emit: () => undefined, logger});
            bindAgentToConnection(agent, conn, {
                auth,
                commandRegistry,
                sessionManager,
                episodicMemory,
                generationService,
                understandingService,
                manager: cm,
                enableNarseseHumanization: config.agent.enableNarseseHumanization,
            });
            logger.info(`Bound bridge to: ${conn.name} (${conn.type})`);
        } catch (e) {
            logger.error(`Failed to add ${cfg.type}: ${(e as Error).message}`);
        }
    }

    agent.start();

    setupGracefulShutdown(async () => {
        logger.info('Shutting down...');
        await sessionManager.snapshot();
        await sessionManager.close();
        agent.stop();
        await cm.shutdownAll();
        logger.info('Bot stopped');
    }, logger);

    logger.info(`Bot ready: ${configs.length} connection(s)`);
    logger.info(`LM: ${lmConfig.provider} ${lmConfig.model}`);
    logger.info(`Try: IRC ${process.env.IRC_SERVER ?? 'irc.libera.chat'} #${(process.env.IRC_CHANNELS ?? '#senars').split(',')[0]}, or ws://localhost:${process.env.WS_PORT ?? '8765'}`);
}

main().catch(err => {
    logger.error('Bot failed to start', err as Error);
    process.exit(1);
});