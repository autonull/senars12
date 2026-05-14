import type {NAR} from '../../nar';

export interface BotHandlerDeps {
    nar: NAR;
    send: (channel: string, user: string, text: string) => void;
}

export type {BeliefHandlerDeps} from './belief-handler.js';
export type {QuestionHandlerDeps} from './question-handler.js';
export type {CommandHandlerDeps} from './command-handler.js';