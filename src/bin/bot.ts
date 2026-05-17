#!/usr/bin/env tsx
/**
 * SeNARS Bot - Multi-connection agent
 *
 * Runs the Agent with IRC, WebSocket, HTTP, and MCP connections.
 * CLI is not started by default - use .connect cli to add it.
 */

import {Agent} from '../agent/Agent.js';
import {AgenticLoop} from '../agent/AgenticLoop.js';
import {ChatResponder} from '../agent/ChatResponder.js';
import {SkillCatalog} from '../agent/SkillCatalog.js';
import {ResponseInterpreter} from '../agent/ResponseInterpreter.js';
import {DegradationManager} from '../agent/DegradationManager.js';
import {ResponseFormatter} from '../agent/ResponseFormatter.js';
import {ConversationManager} from '../agent/ConversationManager.js';
import {SelfAnalyzer} from '../agent/SelfAnalyzer.js';
import {ScenarioRunner} from '../agent/scenarios/ScenarioRunner.js';
import {ScoringEngine} from '../agent/scenarios/ScoringEngine.js';
import {ExperimentRunner} from '../agent/experiments/ExperimentRunner.js';
import {RLFPBridge} from '../agent/rlfp/RLFPBridge.js';
import {RegressionTracker} from '../agent/scenarios/RegressionTracker.js';
import {BotProfile, ChannelBehavior} from '../agent/BotProfile.js';
import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {createLogger} from '../nar/logger/index.js';
import {DEFAULT_NAR_CONFIG, DEFAULT_BOT_CONFIG} from '../config/defaults.js';
import {setupGracefulShutdown} from '../utils/shutdown.js';
import type {ConnectionConfig} from '../io/types.js';

const logger = createLogger({scope: 'bot'});

async function main() {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({
        ...DEFAULT_NAR_CONFIG,
        providerRegistry: registry,
    });

    const botProfile = new BotProfile();
    const channelBehavior = new ChannelBehavior(DEFAULT_BOT_CONFIG.channel.defaultType);
    const chatResponder = new ChatResponder({
        nar,
        registry,
        name: botProfile.name,
        personality: botProfile.personality,
    });

    const skillCatalog = new SkillCatalog(nar);
    const responseInterpreter = new ResponseInterpreter(nar);
    const degradationManager = new DegradationManager();
    const responseFormatter = new ResponseFormatter(channelBehavior);
    const conversationManager = new ConversationManager();

    const scoringEngine = new ScoringEngine();
    const scenarioRunner = new ScenarioRunner(nar);
    const experimentRunner = new ExperimentRunner(nar, scenarioRunner);
    const selfAnalyzer = new SelfAnalyzer(nar, undefined, scenarioRunner, experimentRunner);
    const regressionTracker = new RegressionTracker();

    const agent = new Agent(nar, logger, chatResponder);

    const loopConfig = DEFAULT_BOT_CONFIG.agenticLoop;
    const loop = new AgenticLoop({
        maxInputTurns: loopConfig.maxInputTurns,
        maxWakeTurns: loopConfig.maxWakeTurns,
        sleepIntervalMs: loopConfig.sleepIntervalMs,
        wakeupIntervalMs: loopConfig.wakeupIntervalMs,
        reasoningStepsPerWake: loopConfig.reasoningStepsPerWake,
        enableLMRules: loopConfig.enableLMRules,
    }, nar);

    loop.setMessageHandler(async (msg) => {
        await agent.router.route(msg, {
            connection: msg.source as any,
            nar: agent.getNAR(),
            respond: async (text) => {
                const chunks = responseFormatter.formatForIRC(text);
                for (const chunk of chunks) {
                    await agent.sendTo(msg.source, msg.sender, chunk);
                }
            }
        });
    });

    loop.start();

    setupGracefulShutdown(async () => {
        await agent.stop();
        loop.stop();
    }, logger);

    await agent.start();

    const connections: Array<{ type: string; config: ConnectionConfig }> = [];

    if (process.env.SENARS_IRC_ENABLED === 'true') {
        connections.push({
            type: 'irc',
            config: {
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
            },
        });
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

    if (process.env.SENARS_MCP_ENABLED === 'true') {
        connections.push({
            type: 'mcp',
            config: {
                id: 'mcp-main',
                type: 'mcp',
                enabled: true,
                config: {
                    transport: (process.env.SENARS_MCP_TRANSPORT as any) || 'stdio',
                },
            },
        });
    }

    for (const {type, config} of connections) {
        try {
            await agent.addConnection(config);
            logger.info(`Connected ${type} connection: ${config.id}`);
        } catch (error) {
            logger.error(`Failed to connect ${type}: ${error}`);
        }
    }

    logger.info(`Bot ready: ${botProfile.name}`);
    logger.info(`Connections: ${connections.length} configured`);
}

main().catch(console.error);
