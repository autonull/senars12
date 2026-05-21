#!/usr/bin/env tsx
/**
 * SeNARS Bot - Multi-connection agent
 *
 * Runs the Agent with IRC, WebSocket, HTTP, and MCP connections.
 * CLI is not started by default - use .connect cli to add it.
 */

import {Agent} from '../agent/Agent.js';
import {AgenticLoop} from '../agent/AgenticLoop.js';
import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {createLogger} from '../nar/logger/index.js';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {DEFAULT_NAR_CONFIG, DEFAULT_BOT_CONFIG} from '../config/defaults.js';
import {setupGracefulShutdown} from '../utils/shutdown.js';
import type {ConnectionConfig, IOMessage} from '../io/types.js';
import type {ChannelType} from '../agent/ChannelBehavior.js';
import {SeNARSMCPServer} from '../api/mcp-server.js';
import {registerNARToolsAsMCP, registerAgentAPI as registerMCPAgentAPI} from '../api/mcp-tools.js';
import {registerMCPPrompts} from '../api/mcp-prompts.js';
import {registerMCPResources} from '../api/mcp-resources.js';
import {registerScenarioAPIs, registerExperimentAPIs, registerSelfAnalysisAPIs, registerRegressionAPIs} from '../api/agent-api.js';
import {ScenarioRunner} from '../agent/scenarios/ScenarioRunner.js';
import {ScoringEngine} from '../agent/scenarios/ScoringEngine.js';
import {ExperimentRunner} from '../agent/experiments/ExperimentRunner.js';
import {RegressionTracker} from '../agent/scenarios/RegressionTracker.js';
import {SelfAnalyzer} from '../agent/SelfAnalyzer.js';

const logger = createLogger({scope: 'bot'});

async function main() {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({
        ...DEFAULT_NAR_CONFIG,
        providerRegistry: registry,
    });

    const agent = new Agent({
        nar,
        logger,
        botProfile: {},
    });

    const episodicMemory = new EpisodicMemory();

    const scoringEngine = new ScoringEngine();
    const scenarioRunner = new ScenarioRunner(nar);
    const experimentRunner = new ExperimentRunner(nar, scenarioRunner);
    const selfAnalyzer = new SelfAnalyzer(nar, undefined, scenarioRunner, experimentRunner);
    const regressionTracker = new RegressionTracker();

    let mcpServer: SeNARSMCPServer | undefined;
    if (process.env.SENARS_MCP_ENABLED === 'true') {
        mcpServer = new SeNARSMCPServer({
            name: 'senars-bot',
            version: '1.0.0',
            transport: (process.env.SENARS_MCP_TRANSPORT as any) || 'stdio',
        });

        const adapter = mcpServer.getAdapter();
        registerMCPAgentAPI(agent, adapter);
        registerNARToolsAsMCP(nar, adapter);
        registerMCPPrompts(adapter);
        registerMCPResources(adapter, nar);
        registerScenarioAPIs(scenarioRunner);
        registerExperimentAPIs(experimentRunner);
        registerSelfAnalysisAPIs(selfAnalyzer);
        registerRegressionAPIs(regressionTracker);

        await mcpServer.start();
        logger.info('MCP Server started');
    }

    const loopConfig = DEFAULT_BOT_CONFIG.agenticLoop;
    const loop = new AgenticLoop(
        agent,
        episodicMemory,
        {
            maxInputTurns: loopConfig.maxInputTurns,
            maxWakeTurns: loopConfig.maxWakeTurns,
            sleepIntervalMs: loopConfig.sleepIntervalMs,
            wakeupIntervalMs: loopConfig.wakeupIntervalMs,
            reasoningStepsPerWake: loopConfig.reasoningStepsPerWake,
            enableLMRules: loopConfig.enableLMRules,
        }
    );

    loop.setMessageHandler(async (msg: IOMessage) => {
        const connectionType: ChannelType = msg.source === 'irc-main' ? 'irc' : msg.source === 'ws-main' ? 'ws' : msg.source === 'http-main' ? 'http' : 'cli';
        const ctx = {
            connectionId: msg.source,
            connectionType,
            sender: msg.sender,
            respond: async (text: string) => {
                await agent.sendTo(msg.source, msg.sender, text);
            },
        };
        const response = await agent.processMessage(msg.text, ctx);
        if (response.text) {
            await ctx.respond(response.text);
        }
    });

    loop.start();

    setupGracefulShutdown(async () => {
        await agent.stop();
        loop.stop();
        if (mcpServer) {
            mcpServer.stop();
        }
    }, logger);

    await agent.start();

    const connections: Array<{ type: string; config: ConnectionConfig }> = [];

    if (process.env.SENARS_IRC_ENABLED === 'true') {
        const ircConfig = {
            id: 'irc-main',
            type: 'irc',
            enabled: true,
            authSecret: process.env.SENARS_IRC_AUTH_SECRET,
            config: {
                server: process.env.SENARS_IRC_SERVER || 'irc.libera.chat',
                port: parseInt(process.env.SENARS_IRC_PORT || '6667'),
                nick: process.env.SENARS_IRC_NICK || 'senars-bot',
                channels: process.env.SENARS_IRC_CHANNELS?.split(',') || ['#senars'],
            },
        };
        connections.push({type: 'irc', config: ircConfig});
    }

    if (process.env.SENARS_WS_ENABLED === 'true' || process.env.SENARS_HTTP_ENABLED === 'true') {
        connections.push({
            type: 'websocket',
            config: {
                id: 'ws-main',
                type: 'websocket',
                enabled: true,
                config: {
                    port: parseInt(process.env.SENARS_WS_PORT || '8080'),
                },
            },
        });
    }

    if (process.env.SENARS_HTTP_ENABLED === 'true') {
        connections.push({
            type: 'http',
            config: {
                id: 'http-main',
                type: 'http',
                enabled: true,
                config: {
                    port: parseInt(process.env.SENARS_HTTP_PORT || '8081'),
                },
            },
        });
    }

    for (const {type, config} of connections) {
        try {
            const connection = await agent.addConnection(config);
            logger.info(`Connected ${type} connection: ${config.id}`);

            if (type === 'irc') {
                logger.info(`IRC connection added for ${config.id}`);
            }
        } catch (error) {
            logger.error(`Failed to connect ${type}: ${error}`);
        }
    }

    logger.info(`Bot ready: ${agent.profile.name}`);
    logger.info(`Connections: ${connections.length} configured`);
}

main().catch(console.error);