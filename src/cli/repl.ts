/**
 * SeNARS CLI REPL - Interactive terminal interface for neuro-symbolic reasoning
 */

import {SeNARSFactory} from '../nar';
import {createInterface} from 'readline';
import {HistoryManager} from './history';
import {CommandHandlers} from './command-handlers';
import {showHelp} from './display';

interface CLIConfig {
    maxConcepts: number;
    maxDerivationDepth: number;
    showDerivations: boolean;
}

type NARRef = ReturnType<typeof SeNARSFactory.createForCLI>;

const COMMANDS = ['.help', '.run', '.stats', '.list', '.concepts', '.rules', '.tools',
    '.query', '.trace', '.explain', '.clear', '.load', '.save',
    '.config', '.profile', '.quit', '.self', '.meta', '.optimize',
    '.prefer', '.reward', '.rlfp-stats', '.lm-status', '.lm-switch', '.ask-nl',
    '.constitution', '.attention', '.load-domain'];

export class SeNARSCLI {
    private readonly nar: NARRef;
    private readonly rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'senars> ',
        completer: (line: string): [string[], string] => this.completer(line)
    });
    private readonly history = new HistoryManager();
    private commands!: CommandHandlers;
    private multiLineBuffer: string[] = [];
    private inMultiLine = false;

    constructor(config: Partial<CLIConfig> = {}) {
        this.nar = SeNARSFactory.createForCLI({
            maxConcepts: config.maxConcepts ?? 100,
            maxDerivationDepth: config.maxDerivationDepth ?? 10
        }) as NARRef;

        this.commands = new CommandHandlers(this.nar);

        this.rl.on('line', (line) => this.onLine(line));
        this.rl.on('close', () => {
            this.history.saveHistory();
            console.log('\nGoodbye!');
            process.exit(0);
        });
    }

    start(): void {
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║ SeNARS CLI REPL v1.0                             ║');
        console.log('║ Neuro-Symbolic Reasoning System                  ║');
        console.log('╚══════════════════════════════════════════════════╝');
        console.log('\nType .help for commands, .quit to exit\n');
        this.rl.prompt();
    }

    private onLine(line: string): void {
        if (this.inMultiLine) {
            if (line.trim() === '.') {
                const input = this.multiLineBuffer.join('\n');
                this.multiLineBuffer = [];
                this.inMultiLine = false;
                this.history.add(input);
                this.commands.handleCommand(input);
            } else {
                this.multiLineBuffer.push(line);
            }
        } else {
            const trimmed = line.trim();
            if (!trimmed) {
                this.rl.prompt();
                return;
            }
            if (trimmed.startsWith('{')) {
                this.inMultiLine = true;
                this.multiLineBuffer = [trimmed.slice(1)];
                console.log('> Multi-line input started (end with "." on empty line)');
            } else {
                this.history.add(trimmed);
                this.dispatch(trimmed);
            }
        }
        this.rl.prompt();
    }

    private dispatch(input: string): void {
        const trimmed = input.trim();
        if (trimmed.startsWith('.')) {
            this.commands.handleCommand(trimmed);
        } else if (trimmed.endsWith('?')) {
            this.commands.handleQuestion(trimmed.slice(0, -1).trim());
        } else if (trimmed.endsWith('.')) {
            this.commands.handleBelief(trimmed.slice(0, -1).trim());
        } else {
            console.log('Syntax: (term). for beliefs, (term)? for questions, or .help');
        }
    }

    private completer(line: string): [string[], string] {
        const parts = line.split(/\s+/);
        const lastPart = parts[parts.length - 1] || '';

        if (line.startsWith('.')) {
            const matches = COMMANDS.filter(cmd => cmd.startsWith(lastPart));
            return [matches.length ? matches : [line], lastPart];
        }

        const concepts = this.nar.listConcepts().slice(0, 50);
        const matches = concepts.map(c => c.term.toString()).filter(term => term.startsWith(lastPart));
        return [matches.length ? matches : [line], lastPart];
    }
}

const cli = new SeNARSCLI();
cli.start();