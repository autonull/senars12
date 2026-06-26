#!/usr/bin/env tsx
/**
 * SeNARS Bot - Multi-connection agent.
 *
 * Default config: connects to irc.libera.chat#senars as `senars-bot`
 * and starts a WebSocket server on 8765. Set ENABLE_HTTP=true or
 * ENABLE_MCP=true to opt in to additional transports.
 */

import {createAgent} from '../agent/agent.js';
import {createAutonomyEngine} from '../agent/index.js';
import {ConnectionManager} from '../io/connection-manager.js';
import {AuthManager} from '../io/auth.js';
import {CommandRegistry} from '../io/commands/registry.js';
import {CLIConnection, HTTPConnection, IRCConnection, MCPConnection, WSConnection} from '../io/index.js';
import {bindAgentToConnection} from '../agent/io-bridge.js';
import {agentConfigToOptions, createConnectionConfigsFromEnv} from '../agent/options-schema.js';
import {JsonlSessionManager} from '../agent/SessionManager.js';
import {registerAllCommands} from '../agent/register-commands.js';
import {NLGenerationService} from '../nar/nl/generation.js';
import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {setupDefaultLMClient} from '../nar/lm/defaults.js';
import {resolveLMConfig} from '../nar/lm/env-config.js';
import {createLogger} from '../nar/logger/index.js';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {DEFAULT_NAR_CONFIG} from '../config/defaults.js';
import {loadConfigFromEnv} from '../config/index.js';
import {setupGracefulShutdown} from '../utils/shutdown.js';
import {assertValidEnv} from '../utils/env-validate.js';
import {mkdir} from 'node:fs/promises';

assertValidEnv();

const logger = createLogger({scope: 'bot'});

async function main(): Promise<void> {
    const config = await loadConfigFromEnv();

    const registry = createSeNARSRegistry();
    const lmClient = setupDefaultLMClient();
    const lmConfig = resolveLMConfig();
    const nar = SeNARSFactory.createDefault({
        ...DEFAULT_NAR_CONFIG,
        providerRegistry: registry,
        lmClient,
    });

    const episodicMemory = new EpisodicMemory({
        enabled: true,
        maxEntriesPerFile: 100,
        basePath: process.env.EPISODIC_MEMORY_PATH || '.cache/episodes',
        retentionDays: parseInt(process.env.EPISODIC_RETENTION_DAYS || '30'),
    });

    // Create and configure AutonomyEngine
    const systemEventBus = nar.getSystemEventBus();
    const autonomyEngine = createAutonomyEngine(nar, systemEventBus);
    autonomyEngine.setNotifyHandler((msg) => logger.debug(`[Autonomy] ${msg}`));

    const externalTools = {
        webSearch: {apiKey: process.env.BRAVE_API_KEY ?? process.env.TAVILY_API_KEY},
        codeExec: {maxTimeout: 10000, maxOutputBytes: 1024 * 1024},
        fs: {maxReadSize: 1024 * 1024},
    };

    const agentOptions = {
        nar,
        lmClient,
        episodicMemory,
        autonomyEngine,
        externalTools,
        workspaceRoot: process.cwd(),
        ...agentConfigToOptions(config.agent)
    };
    const agent = createAgent(agentOptions);

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

    const generationService = new NLGenerationService(registry);

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

    logger.info(`Bot ready: ${configs.length} connection(s), mode=${lmClient ? 'full' : 'senars-only'}`);
    logger.info(`LM: ${lmConfig.provider} ${lmConfig.model}`);
    logger.info(`Try: IRC ${process.env.IRC_SERVER ?? 'irc.libera.chat'} #${(process.env.IRC_CHANNELS ?? '#senars').split(',')[0]}, or ws://localhost:${process.env.WS_PORT ?? '8765'}`);
}

main().catch(err => {
    logger.error('Bot failed to start', err as Error);
    process.exit(1);
});
