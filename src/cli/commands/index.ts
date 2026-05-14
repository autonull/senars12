/**
 * Command handler interface and base types
 */
import type {NAR} from '../../nar/nar.js';

export interface CommandHandler {
    name: string;
    description: string;

    execute(args: string[]): Promise<void> | void;
}

export interface CommandRegistry {
    register(handler: CommandHandler): void;

    get(name: string): CommandHandler | undefined;

    list(): CommandHandler[];
}

export function createCommandHandler(
    name: string,
    description: string,
    execute: (args: string[], nar: NAR) => Promise<void> | void
): CommandHandler {
    return {
        name,
        description,
        execute: (args: string[]) => execute(args, (globalThis as any)._narInstance)
    };
}
