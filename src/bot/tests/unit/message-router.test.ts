import {createMessageRouter} from '../../message-router.js';
import {SeNARSFactory} from '../../../nar';

describe('message-router', () => {
    test('routes belief text to belief handler', async () => {
        const nar = SeNARSFactory.createForBot({maxConcepts: 100});
        const sent: Array<[string, string, string]> = [];
        const send = (ch: string, u: string, t: string) => sent.push([ch, u, t]);
        const router = createMessageRouter({nar, send});

        await router('#ch', 'user', '(A --> B).');
        expect(sent.some(([, , t]) => t.includes('Added'))).toBe(true);
    });

    test('routes question text to question handler', async () => {
        const nar = SeNARSFactory.createForBot({maxConcepts: 100});
        const sent: Array<[string, string, string]> = [];
        const send = (ch: string, u: string, t: string) => sent.push([ch, u, t]);
        const router = createMessageRouter({nar, send});

        await router('#ch', 'user', '(A --> B)?');
        expect(sent.some(([, , t]) => t.includes('Derived') || t.includes('No derivation'))).toBe(true);
    });

    test('ignores URLs', async () => {
        const nar = SeNARSFactory.createForBot({maxConcepts: 100});
        const sent: Array<[string, string, string]> = [];
        const send = (ch: string, u: string, t: string) => sent.push([ch, u, t]);
        const router = createMessageRouter({nar, send});

        await router('#ch', 'user', 'check this http://example.com out');
        expect(sent.length).toBe(0);
    });

    test('routes non-matching text to NL handler', async () => {
        const nar = SeNARSFactory.createForBot({maxConcepts: 100});
        const sent: Array<[string, string, string]> = [];
        const send = (ch: string, u: string, t: string) => sent.push([ch, u, t]);
        const router = createMessageRouter({nar, send});

        await router('#ch', 'user', 'hello world');
        expect(sent).toContainEqual(['#ch', 'user', expect.stringContaining('belief')]);
    });
});