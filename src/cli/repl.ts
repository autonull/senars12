/**
 * SeNARS CLI REPL - Unified entry point for TTY and pipe modes
 */

import {Agent} from '../agent/Agent.js';
import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {createLogger} from '../nar/logger/index.js';
import {DEFAULT_NAR_CONFIG} from '../config/defaults.js';
import {setupGracefulShutdown} from '../utils/shutdown.js';
import {PipeOutput} from './PipeOutput.js';
import {createInterface} from 'readline';
import type {ChannelType} from '../agent/ChannelBehavior.js';

interface CLIOptions {
    json?: boolean;
    quiet?: boolean;
    noInit?: boolean;
    timeout?: number;
    maxTurns?: number;
}

function parseArgs(): {options: CLIOptions; commands: string[]} {
    const args = process.argv.slice(2);
    const options: CLIOptions = {};
    const commands: string[] = [];

    for (const arg of args) {
        if (arg === '--json') options.json = true;
        else if (arg === '--quiet') options.quiet = true;
        else if (arg === '--no-init') options.noInit = true;
        else if (arg.startsWith('--timeout=')) options.timeout = parseInt(arg.split('=')[1]!);
        else if (arg.startsWith('--max-turns=')) options.maxTurns = parseInt(arg.split('=')[1]!);
        else commands.push(arg);
    }

    return {options, commands};
}

export class SeNARSCLI {
    readonly agent: Agent;
    readonly logger = createLogger({scope: 'cli:repl'});
    private isTTY: boolean;
    private pipeOutput: PipeOutput;
    private options: CLIOptions;
    private turnCount = 0;
    private inputBuffer = '';
    private bufferingTimeout: NodeJS.Timeout | null = null;

    constructor(options: CLIOptions = {}) {
        const registry = createSeNARSRegistry();
        const nar = SeNARSFactory.createDefault({
            ...DEFAULT_NAR_CONFIG,
            providerRegistry: registry,
        });
        this.options = options;
        this.agent = new Agent({nar});
        this.isTTY = process.stdin.isTTY ?? false;
        this.pipeOutput = new PipeOutput({options});
    }

    async start(): Promise<void> {
        if (!this.options.noInit && !this.isTTY) {
            process.stdout.write(this.pipeOutput.formatInit() + '\n');
        }

        await this.agent.start();

        if (this.isTTY) {
            await this.startTTYMode();
        } else {
            await this.startPipeMode();
        }
    }

private async startTTYMode(): Promise<void> {
if (!this.options.noInit) {
console.log('SeNARS CLI - Interactive terminal interface');
console.log('Type .help for commands, .quit to exit\n');
}

        const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'senars> ',
            terminal: true,
        });

rl.on('line', async (line) => {
const trimmed = line.trim();
if (!trimmed) {
rl.prompt();
return;
}

if (trimmed === '.quit' || trimmed === '.exit' || trimmed === '/quit' || trimmed === '/exit') {
rl.close();
return;
}

this.turnCount++;
const response = await this.agent.processMessage(trimmed, {
connectionId: 'cli',
connectionType: 'cli',
sender: 'local-user',
respond: async (text) => console.log(text),
});

if (this.turnCount >= (this.options.maxTurns ?? Infinity)) {
rl.close();
return;
}

rl.prompt();
});

rl.on('close', () => {
console.log('\nGoodbye!');
process.exit(0);
});

process.on('SIGINT', () => {
rl.close();
});

        rl.prompt();
    }

    private async startPipeMode(): Promise<void> {
        const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false,
        });

let lastInputTime = Date.now();
const checkTimeout = () => {
if (this.options.timeout && Date.now() - lastInputTime > this.options.timeout) {
process.exit(0);
}
};

const timeoutInterval = setInterval(checkTimeout, 1000);

rl.on('line', async (line) => {
lastInputTime = Date.now();
            const trimmed = line.trim();

            if (!trimmed) return;

            if (this.inputBuffer) {
                if (trimmed === '.') {
                    const fullInput = this.inputBuffer;
                    this.inputBuffer = '';
                    await this.processInput(fullInput);
                } else {
                    this.inputBuffer += '\n' + trimmed;
                }
                return;
            }

if (trimmed.startsWith('(') && !trimmed.includes(').')) {
this.inputBuffer = trimmed;
if (this.bufferingTimeout) clearTimeout(this.bufferingTimeout);
this.bufferingTimeout = setTimeout(() => {
if (this.inputBuffer) {
const discard = this.inputBuffer;
this.inputBuffer = '';
process.stderr.write(`! Buffer timeout, discarding: ${discard.slice(0, 50)}...\n`);
}
}, 30000);
return;
}

            await this.processInput(trimmed);

            if (this.turnCount >= (this.options.maxTurns ?? Infinity)) {
                rl.close();
                clearInterval(timeoutInterval);
            }
        });

        rl.on('close', () => {
            if (this.inputBuffer) {
                process.stderr.write(`! EOF with uncommitted buffer\n`);
            }
            clearInterval(timeoutInterval);
            process.exit(0);
        });
    }

private async processInput(text: string): Promise<void> {
if (!this.options.quiet) {
process.stdout.write(`> ${text}\n`);
}

        if (text === '.quit' || text === '.exit' || text === '/quit' || text === '/exit') {
            process.stdout.write(this.pipeOutput.formatQuit() + '\n');
            process.exit(0);
            return;
        }

try {
await this.agent.processMessage(text, {
connectionId: 'pipe',
connectionType: 'cli',
sender: 'pipe-user',
respond: async (t) => { process.stdout.write(`< ${t}\n`); },
});
} catch (error) {
process.stderr.write(`! Error: ${error}\n`);
}

this.turnCount++;
    }
}

async function main() {
    const {options} = parseArgs();
    const cli = new SeNARSCLI(options);
    setupGracefulShutdown(() => cli.agent.stop(), cli.logger);
    await cli.start();
}

main();