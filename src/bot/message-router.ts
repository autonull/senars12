import type {NAR} from '../nar/index.js';
import {parseCommand, createCommandHandlers, isBelief, isQuestion, createBeliefHandler, createQuestionHandler, createNlHandler} from './handlers/index.js';

export interface RouterDeps {
    nar: NAR;
    send: (channel: string, user: string, text: string) => void;
}

export function createMessageRouter(deps: RouterDeps) {
    const commands = createCommandHandlers(deps);
    const handleBelief = createBeliefHandler(deps);
    const handleQuestion = createQuestionHandler(deps);
    const handleNl = createNlHandler(deps);

    return async (channel: string, user: string, text: string): Promise<void> => {
        const trimmed = text.trim();

        if (trimmed.includes('http://') || trimmed.includes('https://')) return;

        const parsed = parseCommand(trimmed);
        if (parsed) {
            for (const cmd of commands) {
                if (cmd.matches(parsed.cmd)) {
                    await cmd.handle(channel, user, parsed.args);
                    return;
                }
            }
        }

        if (isBelief(trimmed)) {
            await handleBelief(channel, user, trimmed);
        } else if (isQuestion(trimmed)) {
            await handleQuestion(channel, user, trimmed);
        } else {
            handleNl(channel, user);
        }
    };
}