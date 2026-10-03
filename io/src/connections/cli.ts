import { createInterface, type Interface } from 'node:readline';
import {
  BoundedRing,
  createLogger,
  errMsg,
  isQuitResult,
  QUIT_SENTINEL,
  splitWords,
} from '@senars/util';
import type { ConnectionConfig, ConnectionDeps, IOMessage } from '../types.js';
import { BaseConnection } from './base.js';

export interface CLICommand {
  readonly name: string;
  readonly description: string;
  readonly execute: (args: string) => string | Promise<string>;
}

export { QUIT_SENTINEL };

/** Deepest command backlog the REPL holds while the previous command is still running. */
const MAX_QUEUED_COMMANDS = 1000;

export class CLIConnection extends BaseConnection {
  override readonly type = 'cli';
  override readonly logger = createLogger({ scope: 'io:cli' });
  private rl: Interface | null = null;
  private readonly sendFn: (text: string) => void;
  private readonly commands: Map<string, CLICommand>;
  private readonly cmdQueue: BoundedRing<() => Promise<void>>;
  private cmdRunning = false;

  constructor(config: ConnectionConfig, deps: ConnectionDeps) {
    super(config, deps);
    this.name = (config.config.name as string) ?? 'CLI';
    this.sendFn = (config.config.sendFn as (text: string) => void) ?? ((text) => console.log(text));
    this.cmdQueue = new BoundedRing<() => Promise<void>>(MAX_QUEUED_COMMANDS);
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
        const parts = splitWords(line);
        const lastPart = line.endsWith(' ') ? '' : (parts.at(-1) ?? '');
        const dotCmds = Array.from(this.commands.keys()).map((c) => `.${c}`);
        const dotMatches = dotCmds.filter((cmd) => cmd.startsWith(lastPart));
        const all = dotMatches.length ? dotMatches : [lastPart];
        return [all, lastPart];
      },
    });

    this.rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        this.rl?.prompt();
        return;
      }

      if (trimmed.startsWith('.')) {
        const rest = trimmed.slice(1);
        this.cmdQueue.push(async () => {
          await this.tryCommand(rest);
          this.processQueue();
        });
        if (!this.cmdRunning) this.processQueue();
        return;
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
    const handlers = this.messageHandlers.receivers();
    void Promise.allSettled(handlers.map((h) => h(message))).then((results) =>
      this.accountHandlerResults(results)
    );
  };

  private async tryCommand(rest: string): Promise<void> {
    const parts = splitWords(rest);
    const cmdName = parts[0] ?? '';
    if (!cmdName) return;
    const args = parts.slice(1).join(' ');
    const cmd = this.commands.get(cmdName);
    if (!cmd) {
      this.sendFn(`Unknown command: ${cmdName}`);
      return;
    }

    try {
      const result = await cmd.execute(args);
      if (isQuitResult(result)) {
        this.sendFn('Goodbye!');
        await this.disconnect('quit');
        return;
      }
      if (result) this.sendFn(result);
    } catch (err) {
      this.sendFn(`Error: ${errMsg(err)}`);
    }
  }

  private processQueue(): void {
    if (this.cmdQueue.size === 0) {
      this.cmdRunning = false;
      this.rl?.prompt();
      return;
    }
    this.cmdRunning = true;
    const next = this.cmdQueue.shift()!;
    next().catch(() => {
      // Error already handled in tryCommand
    });
  }
}
