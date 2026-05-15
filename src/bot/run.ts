#!/usr/bin/env node
import {loadConfig, mergeConfig} from './config.js';
import {createBot, createRealBot} from './index.js';
import {Logger, LoggerFactory} from '../nar/logger/index.js';

const logger = LoggerFactory.getInstance().get('bot:run');

(async () => {
    const args = process.argv.slice(2);
    const profileArg = args.find(a => a.startsWith('--profile='));
    const profile = (profileArg ? profileArg.split('=')[1] : 'minimal') as 'minimal' | 'standard' | 'full';

    const fileConfig = await loadConfig(args.find(a => a.startsWith('--config='))?.split('=')[1]);
    const portArg = args.find(a => a.startsWith('--port='));
    const port = portArg ? parseInt(portArg.split('=')[1]!, 10) : undefined;

// Override port in config if specified via command line
    let config = mergeConfig(fileConfig, {profile});
    if (port) {
        config = {
            ...config,
            embodiments: {
                ...config.embodiments,
                irc: {...config.embodiments?.irc, port, enabled: config.embodiments?.irc?.enabled ?? true},
            },
        };
    }

    const serverArg = args.find(a => a.startsWith('--server='));
    const nickArg = args.find(a => a.startsWith('--nick='));

    if (serverArg) {
        const server = serverArg.split('=')[1] ?? serverArg;
        const port = portArg ? parseInt(portArg.split('=')[1] ?? '6667', 10) : 6667;
        const nick = nickArg?.split('=')[1] ?? 'SeNARchy';
        const channel = config.embodiments?.irc?.channel ?? '#senars';

        if (config.debug) {
            logger.info(`[Bot] Connecting to ${server}:${port} as ${nick}`);
        }

        const bot = await createRealBot({
            server,
            port,
            nick,
            channels: [channel],
            tls: config.embodiments?.irc?.tls ?? false,
        });

        process.on('SIGINT', async () => {
            logger.info('[Bot] Shutting down...');
            await bot.shutdown();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            await bot.shutdown();
            process.exit(0);
        });

        await bot.start();
    } else {
        if (config.debug) {
            logger.info(`[Bot] Starting with profile: ${config.profile || 'minimal'}`);
        }

        const bot = await createBot(config);

        process.on('SIGINT', async () => {
            logger.info('[Bot] Shutting down...');
            await bot.shutdown();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            await bot.shutdown();
            process.exit(0);
        });

        await bot.start();
    }
})();