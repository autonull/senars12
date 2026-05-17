/**
 * SeNARS CLI REPL - Interactive terminal interface using Agent + CLIConnection
 */

import {Agent} from '../agent/Agent.js';
import {ChatResponder} from '../agent/ChatResponder.js';
import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {createLogger} from '../nar/logger/index.js';
import {DEFAULT_NAR_CONFIG} from '../config/defaults.js';
import {setupGracefulShutdown} from '../utils/shutdown.js';
import {k} from './display.js';

export class SeNARSCLI {
    readonly agent: Agent;
    readonly logger = createLogger({scope: 'cli:repl'});

    constructor() {
        const registry = createSeNARSRegistry();
        const nar = SeNARSFactory.createDefault({
            ...DEFAULT_NAR_CONFIG,
            providerRegistry: registry,
        });
        const chatResponder = new ChatResponder({
            nar,
            registry,
            name: 'SeNARS',
        });
        this.agent = new Agent(nar, undefined, chatResponder);
    }

    async start(): Promise<void> {
        console.log(k.bold('SeNARS CLI') + ' - Interactive terminal interface');
        console.log(k.dim('Type .help for commands, .quit to exit\n'));

        const cliConfig = {
            id: 'cli',
            type: 'cli' as const,
            enabled: true,
            config: {
                name: 'CLI',
                sendFn: (text: string) => console.log(text),
            }
        };

        const connection = await this.agent.addConnection(cliConfig);

        connection.onMessage(async (message) => {
            const nar = this.agent.getNAR();
            const context = {
                connection,
                nar,
                respond: async (text: string) => connection.send(message.sender, text),
            };
            try {
                await this.agent.router.route(message, context);
            } catch (error) {
                console.log(k.err(`Error: ${error}`));
            }
        });

        this.agent.on('connection:state', (data) => {
            const {id, prev, current} = data as { id: string; prev: string; current: string };
            if (id === 'cli') {
                this.logger.debug(`CLI state: ${prev} -> ${current}`);
            }
        });

        await this.agent.start();
    }
}

async function main() {
    const cli = new SeNARSCLI();
    await cli.start();
    setupGracefulShutdown(() => cli.agent.stop(), cli.logger);
}

main();
