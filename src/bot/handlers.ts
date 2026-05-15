import type {NAR} from '../nar/nar.js';

export interface HandlerDeps { nar: NAR; send: (channel: string, user: string, text: string) => void; }

export interface CommandHandler {
    handle: (channel: string, user: string, args: string[]) => Promise<void>;
    matches: (cmd: string) => boolean;
    readonly name: string;
    readonly help: string;
}

export const isBelief = (text: string): boolean => text.trim().endsWith('.');
export const isQuestion = (text: string): boolean => text.trim().endsWith('?');

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
        if (derived > 0) deps.send(channel, user, `Derived ${derived} new belief(s)`);
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

const cmd = (deps: HandlerDeps, name: string, help: string, fn: (ch: string, u: string, args: string[]) => Promise<void>): CommandHandler =>
    Object.freeze({name, help, matches: (c: string) => c === name || c === `!${name.slice(1)}`, handle: fn});

export function createCommandHandlers(deps: HandlerDeps): readonly CommandHandler[] {
    return Object.freeze([
        cmd(deps, '.help', 'Commands: (term). add belief | (term)? ask | .stats | .clear', async (ch, u) => deps.send(ch, u, 'Commands: (term). add belief | (term)? ask | .stats | .clear')),
        cmd(deps, '.stats', 'Show concept and task counts', async (ch, u) => {
            const {totalConcepts, totalTasks} = deps.nar.getStatistics();
            deps.send(ch, u, `Concepts: ${totalConcepts}, Tasks: ${totalTasks}`);
        }),
        cmd(deps, '.clear', 'Clear all memory', async (ch, u) => { deps.nar.clearMemory(); deps.send(ch, u, 'Memory cleared'); }),
    ]);
}
