import type { NAR } from '../../nar/nar.js';
import type { Connection } from '../types.js';
import type { ConnectionManager } from '../connection-manager.js';

export interface CommandContext {
    readonly nar: NAR;
    readonly connection: Connection;
    readonly manager: ConnectionManager;
}

export type CommandHandler = (args: string[], context: CommandContext) => Promise<string>;

export interface CommandDefinition {
    readonly name: string;
    readonly description: string;
    readonly usage: string;
    execute: CommandHandler;
}

export class CommandRegistry {
    private commands: Map<string, CommandDefinition> = new Map();

    register(cmd: CommandDefinition): void {
        this.commands.set(cmd.name, cmd);
    }

    async execute(name: string, args: string[], context: CommandContext): Promise<string> {
        const cmd = this.commands.get(name);
        if (!cmd) {
            throw new Error(`Unknown command: ${name}`);
        }
        return cmd.execute(args, context);
    }

    list(): ReadonlyMap<string, CommandDefinition> {
        return this.commands;
    }

    get(name: string): CommandDefinition | undefined {
        return this.commands.get(name);
    }
}