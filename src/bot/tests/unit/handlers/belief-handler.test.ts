import {isBelief, createBeliefHandler} from '../../../handlers/belief-handler.js';
import {SeNARSFactory} from '../../../../nar/index.js';

describe('belief-handler', () => {
    describe('isBelief', () => {
        test('identifies statements ending with period', () => {
            expect(isBelief('(A --> B).')).toBe(true);
            expect(isBelief('(bird --> animal).')).toBe(true);
            expect(isBelief('hello?')).toBe(false);
            expect(isBelief('hello')).toBe(false);
        });

        test('handles whitespace', () => {
            expect(isBelief('  (A --> B).  ')).toBe(true);
            expect(isBelief('no period')).toBe(false);
        });
    });

    describe('createBeliefHandler', () => {
        let sent: Array<[string, string, string]>;
        let nar: ReturnType<typeof SeNARSFactory.createForBot>;
        let send: (channel: string, user: string, text: string) => void;

        beforeEach(() => {
            sent = [];
            nar = SeNARSFactory.createForBot({maxConcepts: 100});
            send = (ch: string, u: string, t: string) => sent.push([ch, u, t]);
        });

        test('believes text and reports derived count', async () => {
            const handler = createBeliefHandler({nar, send});
            const derived = await handler('#ch', 'user', '(A --> B).');
            expect(sent).toContainEqual(['#ch', 'user', 'Added: (A --> B)']);
            expect(derived).toBeGreaterThanOrEqual(0);
        });

        test('strips trailing period and spaces', async () => {
            const handler = createBeliefHandler({nar, send});
            await handler('#ch', 'user', '  (X --> Y).  ');
            expect(sent).toContainEqual(['#ch', 'user', 'Added: (X --> Y)']);
        });
    });
});