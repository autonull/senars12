import {createInterface, type Interface} from 'readline';
import type {ConnectionConfig, ConnectionDeps, IOMessage} from '../types.js';
import {BaseConnection} from './base.js';
import {createLogger} from '../../nar/logger/index.js';

export class CLIConnection extends BaseConnection {
  override readonly id: string;
  override readonly name: string;
  override readonly type = 'cli';

  private rl: Interface | null = null;
  override readonly logger = createLogger({scope: 'io:cli'});
  private readonly sendFn: (text: string) => void;

    constructor(config: ConnectionConfig, deps: ConnectionDeps) {
        super(config, deps);
        this.id = config.id;
        this.name = config.config.name as string ?? 'CLI';
        this.sendFn = (config.config.sendFn as ((text: string) => void)) ?? ((text) => console.log(text));
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
                const matches = ['.help', '.quit', '.stats', '.clear', '.self'].filter(cmd =>
                    cmd.startsWith(lastPart)
                );
                return [matches.length ? matches : [line], lastPart];
            }
        });

        this.rl.on('line', async (line) => {
            const trimmed = line.trim();
            if (!trimmed) {
                this.rl?.prompt();
                return;
            }

            const message: IOMessage = {
                id: crypto.randomUUID(),
                source: this.id,
                sender: 'local-user',
                text: trimmed,
                timestamp: Date.now(),
            };

            this.handleMessage(message);
        });

        this.rl.on('close', () => {
            this.setState('disconnected');
        });

        process.on('SIGINT', () => {
            this.rl?.close();
        });

        this.setState('connected');
        this.logger.info(`CLI connection ${this.id} connected`);
    }

    override async disconnect(reason?: string): Promise<void> {
        if (this.state === 'disconnected' || this.state === 'idle') return;

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

    protected override handleMessage(message: IOMessage): void {
        if (this.messageHandler) {
            this.messageHandler(message).catch(err => {
                this.logger.error(`Message handler error`, err as Error);
            });
        }
    }
}