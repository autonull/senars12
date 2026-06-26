import {createInterface, type Interface} from 'readline';
import type {ConnectionConfig, ConnectionDeps, IOMessage} from '../types.js';
import {BaseConnection} from './base.js';
import {createLogger} from '../../nar/logger';

export interface CLICommand {
    readonly name: string;
    readonly description: string;
    readonly execute: (args: string) => string | Promise<string>;
}

export const QUIT_SENTINEL = '__CLI_QUIT__';

const isQuit = (result: string): boolean => result === QUIT_SENTINEL;

export class CLIConnection extends BaseConnection {
    override readonly type = 'cli';
    override readonly logger = createLogger({scope: 'io:cli'});
    private rl: Interface | null = null;
    private readonly sendFn: (text: string) => void;
    private readonly commands: Map<string, CLICommand>;

    constructor(config: ConnectionConfig, deps: ConnectionDeps) {
        super(config, deps);
        this.name = (config.config.name as string) ?? 'CLI';
        this.sendFn = (config.config.sendFn as ((text: string) => void)) ?? ((text) => console.log(text));
        this.commands = new Map();
        const cmds = (config.config.commands as CLICommand[] | undefined) ?? [];
        for (const cmd of cmds) {
            this.commands.set(cmd.name, cmd);
        }
    }

    override async connect(): Promise<void> {
        this.setState('connecting');

        this.rl = createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'senars> ',
            terminal: process.stdin.isTTY,
            completer: (line: string): [string[], string] => {
                const parts = line.split(/\s+/);
                const lastPart = parts[parts.length - 1] || '';
                const dotCmds = Array.from(this.commands.keys()).map(c => `.${c}`);
                const dotMatches = dotCmds.filter(cmd => cmd.startsWith(lastPart));
                const all = dotMatches.length ? dotMatches : [lastPart];
                return [all, lastPart];
            }
        });

        this.rl.on('line', async (line) => {
            const trimmed = line.trim();
            if (!trimmed) {
                this.rl?.prompt();
                return;
            }

            if (trimmed.startsWith('.')) {
                const handled = await this.tryCommand(trimmed.slice(1));
                if (handled) {
                    this.rl?.prompt();
                    return;
                }
            }

            this.handleMessage(this.createMessage('local-user', trimmed));
        });

        this.rl.on('close', () => {
            this.setState('disconnected');
        });

        process.on('SIGINT', () => {
            this.rl?.close();
        });

        this.setState('connected');
        this.logger.info(`CLI connection ${this.id} connected (${this.commands.size} commands)`);
    }

    override async disconnect(reason?: string): Promise<void> {
        if (this.isDisconnected()) return;

        this.setState('disconnecting');
        this.rl?.close();
        this.rl = null;
        this.setState('disconnected');
        this.logger.info(`CLI connection ${this.id} disconnected: ${reason ?? 'normal'}`);
    }

    async send(target: string, text: string): Promise<void> {
        if (target === this.id || target === 'local-user') {
            this.sendFn(text);
        }
    }

    protected override handleMessage = (message: IOMessage): void => {
        const handlers = this.messageHandlers.slice();
        Promise.allSettled(handlers.map(h => h(message)))
            .catch(err => this.logger.error(`Message handler error`, err as Error));
    };

    private async tryCommand(rest: string): Promise<boolean> {
        const parts = rest.split(/\s+/);
        const cmdName = parts[0] ?? '';
        const args = parts.slice(1).join(' ');
        const cmd = this.commands.get(cmdName);
        if (!cmd) return false;

        try {
            const result = await cmd.execute(args);
            if (isQuit(result)) {
                this.sendFn('Goodbye!');
                await this.disconnect('quit');
                return true;
            }
            if (result) this.sendFn(result);
        } catch (err) {
            this.sendFn(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
        return true;
    }
}
