import type {NAR} from '../nar';
import type {IRCServerConfig} from './EmbeddedIRCServer.js';
import {EmbeddedIRCServer} from './EmbeddedIRCServer.js';
import {createMessageRouter} from './message-router.js';

export interface BotSessionDeps {
    nar: NAR;
    ircConfig?: IRCServerConfig;
    debug?: boolean;
}

export class BotSession {
    private readonly nar: NAR;
    private readonly ircServer?: EmbeddedIRCServer;
    private readonly sendFn: (channel: string, user: string, text: string) => void;
    private started = false;

    constructor(deps: BotSessionDeps) {
        this.nar = deps.nar;
        const channel = deps.ircConfig?.channel ?? '#senars';

        if (deps.ircConfig?.port) {
            this.ircServer = new EmbeddedIRCServer(deps.ircConfig);
            const router = createMessageRouter({
                nar: this.nar,
                send: (ch, u, msg) => this.ircServer!.send(ch, `[${u}] ${msg}`),
            });
            this.ircServer.on('message', async ({message}) => {
                if (message.command === 'PRIVMSG') {
                    const text = message.params.slice(0).join(' ');
                    const user = message.prefix?.split('!')[0] ?? 'unknown';
                    try {
                        await router(channel, user, text);
                    } catch (e) {
                        if (deps.debug) console.error('[Bot] Handler error:', e);
                    }
                }
            });
            this.sendFn = (ch: string, _u: string, msg: string) => this.ircServer?.send(ch, msg);
        } else {
            this.sendFn = () => {
            };
        }
    }

    async start(): Promise<void> {
        if (this.started) return;
        this.started = true;
        await this.ircServer?.start();
        await this.nar.run(1);
    }

    async shutdown(): Promise<void> {
        await this.ircServer?.stop();
    }

    getNar(): NAR {
        return this.nar;
    }
}