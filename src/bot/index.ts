import {EmbeddedIRCServer} from './EmbeddedIRCServer.js';
import type {BotConfig} from './config.js';
import {SeNARSFactory} from '../nar';

export interface Bot {
    start: () => Promise<void>;
    shutdown: () => Promise<void>;
    status: any;
}

export async function createBot(config: BotConfig): Promise<Bot> {
    const nar = SeNARSFactory.createForBot({
        maxConcepts: 1000
    });

    const ircCfg = config.embodiments?.irc;
    let ircServer: EmbeddedIRCServer | undefined;

    if (ircCfg?.enabled) {
        ircServer = new EmbeddedIRCServer({port: ircCfg.port ?? 6667, hostname: '127.0.0.1', channel: ircCfg.channel});
        ircServer.on('message', async ({message}) => {
            if (message.command === 'PRIVMSG') {
                const text = message.params.slice(message.params[0]?.startsWith('#') ? 1 : 0).join(' ');
                if (text.includes('http://') || text.includes('https://')) {
                    return;
                }

                const channel = message.params[0]?.startsWith('#') ? message.params[0] : '#test';
                const user = message.prefix?.split('!')[0] || 'unknown';

                if (text.startsWith('.') || text.startsWith('!')) {
                    const cmd = text.split(' ')[0];

                    if (cmd === '.help' || cmd === '!help') {
                        ircServer?.send(channel, `${user}: Commands: (term). add belief | (term)? ask | .stats | .clear`);
                        return;
                    }

                    if (cmd === '.stats' || cmd === '!stats') {
                        const stats = nar.getStatistics();
                        ircServer?.send(channel, `${user}: Concepts: ${stats.totalConcepts}, Tasks: ${stats.totalTasks}`);
                        return;
                    }

                    if (cmd === '.clear' || cmd === '!clear') {
                        nar.clearMemory();
                        ircServer?.send(channel, `${user}: Memory cleared`);
                        return;
                    }
                }

                if (text.endsWith('.')) {
                    await nar.believe(text);
                    ircServer?.send(channel, `✓ Added: ${text}`);

                    const derived = await nar.run(3);
                    if (derived > 0) {
                        ircServer?.send(channel, `  Derived ${derived} new belief(s)`);
                    }
                } else if (text.endsWith('?')) {
                    await nar.question(text);
                    const derived = await nar.run(5);

                    if (derived > 0) {
                        ircServer?.send(channel, `✓ Derived ${derived} belief(s)`);
                    } else {
                        ircServer?.send(channel, `? No derivation found`);
                    }
                } else {
                    ircServer?.send(channel, `${user}: Use (term). for beliefs or (term)? for questions`);
                }
            }
        });
        await ircServer.start();
    }

    return {
        start: async () => {
            console.log('[Bot] Starting SeNARS Bot...');
            if (ircServer) {
                console.log('[Bot] Ready - IRC server active');
            } else {
                console.log('[Bot] Ready - minimal mode');
            }
            await nar.run(1);
        },
        shutdown: async () => {
            console.log('[Bot] Shutting down...');
            await ircServer?.stop();
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
