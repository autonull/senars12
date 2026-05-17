#!/usr/bin/env tsx
/**
 * SeNARS Bot - Multi-connection agent
 *
 * Runs the Agent with IRC, WebSocket, HTTP, and MCP connections.
 * CLI is not started by default - use .connect cli to add it.
 */

import {Agent} from '../agent/Agent.js';
import {ChatResponder} from '../agent/ChatResponder.js';
import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {createLogger} from '../nar/logger/index.js';
import {DEFAULT_NAR_CONFIG} from '../config/defaults.js';
import {setupGracefulShutdown} from '../utils/shutdown.js';
import type {ConnectionConfig} from '../io/types.js';

const logger = createLogger({scope: 'bot'});

async function main() {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({
        ...DEFAULT_NAR_CONFIG,
        providerRegistry: registry,
    });

    const chatResponder = new ChatResponder({
        nar,
        registry,
        name: process.env.SENARS_BOT_NAME || 'SeNARS',
    });

    const agent = new Agent(nar, logger, chatResponder);

    setupGracefulShutdown(() => agent.stop(), logger);

    await agent.start();

    const connections: Array<{ type: string; config: ConnectionConfig }> = [];

    if (process.env.SENARS_IRC_ENABLED === 'true') {
        connections.push({
            type: 'irc',
            config: {
                id: 'irc-main',
                type: 'irc',
                enabled: true,
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

    logger.info('Bot ready');
}

main().catch(console.error);
