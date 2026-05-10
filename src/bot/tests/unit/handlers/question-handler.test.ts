import {isQuestion, createQuestionHandler} from '../../../handlers/question-handler.js';
import {SeNARSFactory} from '../../../../nar/index.js';

describe('question-handler', () => {
    describe('isQuestion', () => {
        test('identifies questions ending with question mark', () => {
            expect(isQuestion('(A --> B)?')).toBe(true);
            expect(isQuestion('Is this true?')).toBe(true);
            expect(isQuestion('(A --> B).')).toBe(false);
            expect(isQuestion('hello')).toBe(false);
        });

        test('handles whitespace', () => {
            expect(isQuestion('  (A --> B)?  ')).toBe(true);
        });
    });

    describe('createQuestionHandler', () => {
        let sent: Array<[string, string, string]>;
        let nar: ReturnType<typeof SeNARSFactory.createForBot>;
        let send: (channel: string, user: string, text: string) => void;

        beforeEach(() => {
            sent = [];
            nar = SeNARSFactory.createForBot({maxConcepts: 100});
            send = (ch: string, u: string, t: string) => sent.push([ch, u, t]);
        });

        test('asks question and derives beliefs', async () => {
            const handler = createQuestionHandler({nar, send});
            const found = await handler('#ch', 'user', '(A --> B)?');
            expect(typeof found).toBe('boolean');
            const hasResponse = sent.some(([, , t]) => t.includes('Derived') || t.includes('No derivation'));
            expect(hasResponse).toBe(true);
        });

        test('responds with either derivation or no results', async () => {
            const handler = createQuestionHandler({nar, send});
            await handler('#ch', 'user', '(X --> Y)?');
            const hasResponse = sent.some(([, , t]) =>
                t.includes('Derived') || t.includes('No derivation')
            );
            expect(hasResponse).toBe(true);
        });
    });
});