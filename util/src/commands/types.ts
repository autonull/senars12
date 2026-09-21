import type { Connection } from '../types/transport.js';

export interface CommandContext {
  readonly connection: Connection;
  readonly manager?: unknown;
  /** D19 (TODO17b): NAR handle for the nar/* command groups. */
  readonly nar?: unknown;
}

export type CommandHandler = (args: string[], context: CommandContext) => Promise<string>;

export interface CommandDefinition {
  readonly name: string;
  readonly description: string;
  readonly usage: string;
  readonly aliases?: string[];
  execute: CommandHandler;
}
