import type {BotConfig} from './config.js';
import {BotSession} from './BotSession.js';
import {SeNARSFactory} from '../nar';
import {RealIRCClient} from './IRCClient.js';
import {createMessageRouter} from './message-router.js';
import {createLogger} from '../nar/logger/index.js';
import {errMsg} from '../nar/utils/index.js';

const logger = createLogger({scope: 'bot'});

export interface Bot {
    start: () => Promise<void>;
    shutdown: () => Promise<void>;
    status: { running: boolean; embodiments: { irc: boolean; cli: boolean } };
}

export interface RealBot {
  start: () => Promise<void>;
  shutdown: () => Promise<void>;
  status: {running: boolean; connected: () => boolean; nick: string};
}

export async function createBot(config: BotConfig): Promise<Bot> {
    const nar = SeNARSFactory.createForBot({maxConcepts: 1000});

    const ircCfg = config.embodiments?.irc;
    const session = new BotSession({
        nar,
        ircConfig: ircCfg?.enabled ? {
            port: ircCfg.port ?? 6667,
            hostname: '127.0.0.1',
            channel: ircCfg.channel ?? '#senars',
        } : undefined,
        debug: config.debug,
    });

    return {
        start: async () => {
            logger.info('[Bot] Starting SeNARS Bot...');
            await session.start();
            logger.info('[Bot] Ready');
        },
        shutdown: async () => {
            logger.info('[Bot] Shutting down...');
            await session.shutdown();
        },
        status: {
            running: true,
            embodiments: {
                irc: ircCfg?.enabled ?? false,
                cli: config.embodiments?.cli?.enabled ?? false,
            },
        },
    };
}

export async function createRealBot(config: {
    server: string;
    port: number;
    nick: string;
    channels: string[];
    tls?: boolean;
    password?: string;
    debug?: boolean;
}): Promise<RealBot> {
    const nar = SeNARSFactory.createForBot({maxConcepts: 1000});
    const irc = new RealIRCClient({
        server: config.server,
        port: config.port,
        nick: config.nick,
        channels: config.channels,
        tls: config.tls,
        password: config.password,
    });

    const send = (channel: string, user: string, text: string) => irc.send(channel, `[${user}] ${text}`);
    const router = createMessageRouter({nar, send});

    irc.on('message', async (channel, user, text) => {
        if (text.includes('http://') || text.includes('https://')) return;
        try {
            await router(channel, user, text);
        } catch (e) {
            if (config.debug) logger.error(`[Bot] Handler error: ${errMsg(e)}`);
        }
    });

    return {
        start: async () => {
            logger.info(`[Bot] Connecting to ${config.server}:${config.port} as ${config.nick}...`);
            await irc.connect();
            logger.info('[Bot] Connected');
            await nar.run(1);
        },
        shutdown: async () => {
            logger.info('[Bot] Shutting down...');
            await irc.disconnect();
        },
        status: {
            running: true,
            connected: () => irc.isConnected(),
            nick: irc.getNick(),
        },
    };
}