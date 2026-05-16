/**
 * SeNARS CLI REPL - Interactive terminal interface using Agent + CLIConnection
 */

import {Agent} from '../agent/Agent.js';
import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {k} from './display.js';
import {createLogger} from '../nar/logger/index.js';

export class SeNARSCLI {
    private readonly agent: Agent;
    private readonly logger = createLogger({scope: 'cli:repl'});

    constructor() {
        const registry = createSeNARSRegistry();
        const nar = SeNARSFactory.createDefault({
            core: {maxConcepts: 100, maxDerivationDepth: 10},
            enableLMRules: true,
            providerRegistry: registry,
        });
        this.agent = new Agent(nar);
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
            const context = {
                connection,
                nar: this.agent.getConnection('cli') ? (this.agent as any).nar : null,
                respond: async (text: string) => connection.send(message.sender, text),
            };
            try {
                await (this.agent as any).router.route(message, context);
            } catch (error) {
                console.log(k.err(`Error: ${error}`));
            }
        });

        this.agent.on('connection:state', (data) => {
            const {id, prev, current} = data as {id: string; prev: string; current: string};
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
    await new Promise(() => {});
}

main();
