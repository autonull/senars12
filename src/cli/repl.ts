/**
 * SeNARS CLI REPL - Unified entry point for TTY and pipe modes
 * Uses BOT6 pipeline architecture
 */

import {Bot, BotProfile, ConversationStateManager} from '../agent/index.js';
import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {createLogger} from '../nar/logger/index.js';
import {DEFAULT_NAR_CONFIG} from '../config/defaults.js';
import {setupGracefulShutdown} from '../utils/shutdown.js';
import {PipeOutput} from './PipeOutput.js';
import {createInterface} from 'readline';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {createREPLCommands} from './commands.js';
import type {ChannelType} from '../agent/ChannelBehavior.js';
import type {IOMessage, StreamChunk, BotResponse} from '../agent/BotContext.js';

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
  readonly bot: Bot;
  readonly nar: any;
  readonly logger = createLogger({scope: 'cli:repl'});
  private isTTY: boolean;
  private pipeOutput: PipeOutput;
  private options: CLIOptions;
  private turnCount = 0;
  private inputBuffer = '';
  private bufferingTimeout: NodeJS.Timeout | null = null;
  private replCommands: ReturnType<typeof createREPLCommands>;

  constructor(options: CLIOptions = {}) {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({
      ...DEFAULT_NAR_CONFIG,
      providerRegistry: registry,
    });

    this.nar = nar;
    const profile = new BotProfile();
    const episodicMemory = new EpisodicMemory();

    this.bot = new Bot({
      profile,
      nar,
      episodicMemory,
      config: {
        streaming: {enabled: false, showReasoningSteps: true, showToolCalls: true},
      },
    });

    this.options = options;
    this.isTTY = process.stdin.isTTY ?? false;
    this.pipeOutput = new PipeOutput({options});
    this.replCommands = createREPLCommands(this.bot, nar);

    this.wireEventListeners();
  }

    private wireEventListeners(): void {
        if (this.options.quiet || !this.isTTY) return;

        this.bot.on('stage:start', ({stage}) => {
            if (this.isTTY) process.stdout.write(`\x1b[2m[${stage}]\x1b[0m `);
        });

        this.bot.on('lm:chunk', ({content}) => {
            process.stdout.write(content);
        });

        this.bot.on('reasoning:end', ({newBeliefs}) => {
            if (newBeliefs.length > 0) {
                process.stdout.write(`\n\x1b[2m  → ${newBeliefs.length} new belief(s)\x1b[0m`);
            }
        });

        this.bot.on('directive:found', ({directive}) => {
            process.stdout.write(`\n\x1b[36m  → directive: ${directive.type}\x1b[0m`);
        });

        this.bot.on('turn:end', ({durationMs}) => {
            if (this.isTTY) process.stdout.write(`\n\x1b[2m[${durationMs}ms]\x1b[0m\n`);
        });

        this.bot.on('turn:error', ({error, stage}) => {
            process.stdout.write(`\n\x1b[31m✗ Error in ${stage}: ${error.message}\x1b[0m\n`);
        });
    }

    async start(): Promise<void> {
        if (!this.options.noInit && !this.isTTY) {
            process.stdout.write(this.pipeOutput.formatInit() + '\n');
        }

        await this.bot.start();

        if (this.isTTY) {
            await this.startTTYMode();
        } else {
            await this.startPipeMode();
        }
    }

    private async startTTYMode(): Promise<void> {
        if (!this.options.noInit) {
            const caps = this.bot.capabilities;
            console.log('SeNARS CLI - BOT6 Pipeline Architecture');
            console.log(`Mode: ${caps.mode}  LM: ${caps.hasLM ? '✓' : '✗'}  SeNARS: ${caps.hasSeNARS ? '✓' : '✗'}`);
            console.log('Type /help for commands, /quit to exit\n');
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
            await this.processInput(trimmed);

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
        let processingPromise: Promise<void> = Promise.resolve();
        const checkTimeout = () => {
            if (this.options.timeout && Date.now() - lastInputTime > this.options.timeout) {
                process.exit(0);
            }
        };

        const timeoutInterval = setInterval(checkTimeout, 1000);

        rl.on('line', (line) => {
            lastInputTime = Date.now();
            const trimmed = line.trim();

            if (!trimmed) return;

            if (trimmed === '.quit' || trimmed === '.exit' || trimmed === '/quit' || trimmed === '/exit') {
                processingPromise = processingPromise.then(async () => {
                    process.stdout.write(this.pipeOutput.formatQuit() + '\n');
                    clearInterval(timeoutInterval);
                    process.exit(0);
                });
                return;
            }

            if (this.inputBuffer) {
                if (trimmed === '.') {
                    const fullInput = this.inputBuffer;
                    this.inputBuffer = '';
                    processingPromise = processingPromise.then(() => this.processInput(fullInput));
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

            processingPromise = processingPromise.then(() => this.processInput(trimmed));
        });

        rl.on('close', async () => {
            await processingPromise;
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

    const cmdResult = await this.replCommands.execute(text);
    if (cmdResult.success) {
      if (cmdResult.output) {
        process.stdout.write(`${cmdResult.output}\n`);
      }
      this.turnCount++;
      return;
    }

    try {
      const state = this.bot.stateManager.getOrCreate('cli-user');
      const connInfo = this.bot.getConnectionInfo(
        {id: crypto.randomUUID(), source: 'cli', sender: 'cli-user', text, timestamp: Date.now()},
        async (t: string | StreamChunk) => {
          if (typeof t === 'string') process.stdout.write(t);
          else if (t.type === 'text') process.stdout.write(t.content);
          else if (t.type === 'status' && t.content === 'typing') process.stdout.write('bot: ');
        },
      );

      const response = await this.bot.processMessage(
        {id: crypto.randomUUID(), source: 'cli', sender: 'cli-user', text, timestamp: Date.now()},
        connInfo,
        state,
      );

      if (!this.options.quiet && response.text) {
        process.stdout.write(`< ${response.text}\n`);
      }
    } catch (error) {
      process.stderr.write(`! Error: ${error instanceof Error ? error.message : String(error)}\n`);
    }

    this.turnCount++;
  }
}

async function main() {
    const {options} = parseArgs();
    const cli = new SeNARSCLI(options);
    setupGracefulShutdown(() => cli.bot.stop(), cli.logger);
    await cli.start();
}

main();
