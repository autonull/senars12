import type { Connection } from './Transport.js';

export interface CommandContext {
  readonly connection: Connection;
  readonly manager?: unknown;
}

export type CommandHandler = (args: string[], context: CommandContext) => Promise<string>;

export interface CommandDefinition {
  readonly name: string;
  readonly description: string;
  readonly usage: string;
  readonly aliases?: string[];
  execute: CommandHandler;
}
