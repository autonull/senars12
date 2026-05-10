import {createNlHandler} from '../../../handlers/nl-handler.js';

describe('nl-handler', () => {
    test('sends usage hint for non-matching text', () => {
        const sent: Array<[string, string, string]> = [];
        const send = (ch: string, u: string, t: string) => sent.push([ch, u, t]);
        const handler = createNlHandler({send});
        handler('#ch', 'user');
        expect(sent).toContainEqual(['#ch', 'user', expect.stringContaining('belief')]);
    });
});