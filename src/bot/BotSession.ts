import type {NAR} from '../nar';
import type {IRCServerConfig} from './EmbeddedIRCServer.js';
import {EmbeddedIRCServer} from './EmbeddedIRCServer.js';
import {createMessageRouter} from './message-router.js';
import {createLogger, type Logger} from '../nar/logger/index.js';
import {errMsg} from '../nar/utils/index.js';

export interface BotSessionDeps {
    nar: NAR;
    ircConfig?: IRCServerConfig;
    debug?: boolean;
}

export class BotSession {
    private readonly nar: NAR;
    private readonly ircServer?: EmbeddedIRCServer;
    private readonly sendFn: (channel: string, user: string, text: string) => void;
    private readonly logger: Logger;
    private started = false;

    constructor(deps: BotSessionDeps) {
        this.nar = deps.nar;
        this.logger = createLogger({scope: 'bot:session'});
        const channel = deps.ircConfig?.channel ?? '#senars';

        if (deps.ircConfig?.port) {
            this.ircServer = new EmbeddedIRCServer(deps.ircConfig);
            this.setupMessageHandler(deps, channel);
            this.sendFn = (ch, _u, msg) => this.ircServer?.send(ch, msg);
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

    private setupMessageHandler(deps: BotSessionDeps, channel: string): void {
        const ircServer = this.ircServer;
        if (!ircServer) return;

        const router = createMessageRouter({
            nar: this.nar,
            send: (ch, u, msg) => ircServer.send(ch, `[${u}] ${msg}`),
        });

        ircServer.on('message', async ({message}) => {
            if (message.command !== 'PRIVMSG') return;

            const text = message.params?.join(' ') ?? '';
            const user = message.prefix?.split('!')?.[0] ?? 'unknown';

            try {
                await router(channel, user, text);
            } catch (error) {
                if (deps.debug) this.logger.error(`[Bot] Handler error: ${errMsg(error)}`);
            }
        });
    }
}