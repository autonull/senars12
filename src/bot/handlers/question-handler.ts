import type {NAR} from '../../nar';

export interface QuestionHandlerDeps {
    nar: NAR;
    send: (channel: string, user: string, text: string) => void;
}

export function isQuestion(text: string): boolean {
    return text.trim().endsWith('?');
}

export function createQuestionHandler(deps: QuestionHandlerDeps) {
    return async (channel: string, user: string, text: string): Promise<boolean> => {
        const questionText = text.trim();
        await deps.nar.question(questionText);
        const derived = await deps.nar.run(5);

        if (derived > 0) {
            deps.send(channel, user, `Derived ${derived} belief(s)`);
            return true;
        }
        deps.send(channel, user, 'No derivation found');
        return false;
    };
}