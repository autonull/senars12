import type {NAR} from '../../nar';

export interface CommandHandlerDeps {
    nar: NAR;
    send: (channel: string, user: string, text: string) => void;
}

export interface CommandHandler {
    handle: (channel: string, user: string, args: string[]) => Promise<void>;
    matches: (cmd: string) => boolean;
    readonly name: string;
    readonly help: string;
}

function createCommandHandler(deps: CommandHandlerDeps, cmd: string, help: string, fn: (channel: string, user: string, args: string[]) => Promise<void>): CommandHandler {
    return Object.freeze({
        name: cmd,
        help,
        matches: (c: string) => c === cmd || c === `!${cmd.slice(1)}`,
        handle: (channel: string, user: string, args: string[]) => fn(channel, user, args),
    });
}

export function createCommandHandlers(deps: CommandHandlerDeps): readonly CommandHandler[] {
    return Object.freeze([
        createCommandHandler(deps, '.help', 'Commands: (term). add belief | (term)? ask | .stats | .clear', async (ch, u) => {
            deps.send(ch, u, `Commands: (term). add belief | (term)? ask | .stats | .clear`);
        }),
        createCommandHandler(deps, '.stats', 'Show concept and task counts', async (ch, u) => {
            const stats = deps.nar.getStatistics();
            deps.send(ch, u, `Concepts: ${stats.totalConcepts}, Tasks: ${stats.totalTasks}`);
        }),
        createCommandHandler(deps, '.clear', 'Clear all memory', async (ch, u) => {
            deps.nar.clearMemory();
            deps.send(ch, u, 'Memory cleared');
        }),
    ]);
}

export function parseCommand(text: string): { cmd: string; args: string[] } | null {
    const trimmed = text.trim();
    if (!trimmed.startsWith('.') && !trimmed.startsWith('!')) return null;

    const spaceIdx = trimmed.indexOf(' ');
    const [cmd, ...argParts] = spaceIdx < 0 ? [trimmed] : [trimmed.slice(0, spaceIdx), trimmed.slice(spaceIdx + 1)];
    return {cmd, args: argParts.join('').split(/\s+/).filter(Boolean)};
}