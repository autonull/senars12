import type {NAR} from '../nar/nar.js';

export interface HandlerDeps {
    nar: NAR;
    send: (channel: string, user: string, text: string) => void;
}

export interface CommandHandler {
    handle: (channel: string, user: string, args: string[]) => Promise<void>;
    matches: (cmd: string) => boolean;
    readonly name: string;
    readonly help: string;
}

export function isBelief(text: string): boolean {
    return text.trim().endsWith('.');
}

export function isQuestion(text: string): boolean {
    return text.trim().endsWith('?');
}

export function parseCommand(text: string): { cmd: string; args: string[] } | null {
    const trimmed = text.trim();
    if (!trimmed.startsWith('.') && !trimmed.startsWith('!')) return null;
    const spaceIdx = trimmed.indexOf(' ');
    const [cmd, ...argParts] = spaceIdx < 0 ? [trimmed] : [trimmed.slice(0, spaceIdx), trimmed.slice(spaceIdx + 1)];
    return {cmd, args: argParts.join('').split(/\s+/).filter(Boolean)};
}

export function createBeliefHandler(deps: HandlerDeps) {
    return async (channel: string, user: string, text: string): Promise<number> => {
        const beliefText = text.trim();
        await deps.nar.believe(beliefText);
        deps.send(channel, user, `Added: ${beliefText}`);
        const derived = await deps.nar.run(3);
        if (derived > 0) {
            deps.send(channel, user, `Derived ${derived} new belief(s)`);
        }
        return derived;
    };
}

export function createQuestionHandler(deps: HandlerDeps) {
    return async (channel: string, user: string, text: string): Promise<boolean> => {
        await deps.nar.question(text.trim());
        const derived = await deps.nar.run(5);
        if (derived > 0) {
            deps.send(channel, user, `Derived ${derived} belief(s)`);
            return true;
        }
        deps.send(channel, user, 'No derivation found');
        return false;
    };
}

export function createNlHandler(deps: HandlerDeps) {
    return (channel: string, user: string): void => {
        deps.send(channel, user, 'Use (term). for beliefs or (term)? for questions');
    };
}

function createCommandHandler(deps: HandlerDeps, cmd: string, help: string, fn: (channel: string, user: string, args: string[]) => Promise<void>): CommandHandler {
    return Object.freeze({
        name: cmd,
        help,
        matches: (c: string) => c === cmd || c === `!${cmd.slice(1)}`,
        handle: (channel: string, user: string, args: string[]) => fn(channel, user, args),
    });
}

export function createCommandHandlers(deps: HandlerDeps): readonly CommandHandler[] {
    return Object.freeze([
        createCommandHandler(deps, '.help', 'Commands: (term). add belief | (term)? ask | .stats | .clear', async (ch, u) => {
            deps.send(ch, u, 'Commands: (term). add belief | (term)? ask | .stats | .clear');
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
