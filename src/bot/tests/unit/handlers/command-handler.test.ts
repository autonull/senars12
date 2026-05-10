import {createCommandHandlers, parseCommand} from '../../../handlers/command-handler.js';
import {SeNARSFactory} from '../../../../nar/index.js';

describe('command-handler', () => {
    let sent: Array<[string, string, string]>;
    let nar: ReturnType<typeof SeNARSFactory.createForBot>;
    let send: (channel: string, user: string, text: string) => void;

    beforeEach(() => {
        sent = [];
        nar = SeNARSFactory.createForBot({maxConcepts: 100});
        send = (ch: string, u: string, t: string) => sent.push([ch, u, t]);
    });

    describe('parseCommand', () => {
        test('parses dot commands', () => {
            expect(parseCommand('.help')).toEqual({cmd: '.help', args: []});
            expect(parseCommand('.stats')).toEqual({cmd: '.stats', args: []});
            expect(parseCommand('.help foo bar')).toEqual({cmd: '.help', args: ['foo', 'bar']});
            expect(parseCommand('!help')).toEqual({cmd: '!help', args: []});
        });

        test('returns null for non-commands', () => {
            expect(parseCommand('hello world')).toBeNull();
            expect(parseCommand('(A --> B)')).toBeNull();
        });
    });

    test('.help responds with help text', async () => {
        const handlers = createCommandHandlers({nar, send});
        const h = handlers.find(h => h.name === '.help')!;
        expect(h).toBeDefined();
        await h.handle('#ch', 'user', []);
        expect(sent).toContainEqual(['#ch', 'user', expect.stringContaining('Commands')]);
    });

    test('.stats responds with concept count', async () => {
        const handlers = createCommandHandlers({nar, send});
        const h = handlers.find(h => h.name === '.stats')!;
        expect(h).toBeDefined();
        await h.handle('#ch', 'user', []);
        expect(sent).toContainEqual(['#ch', 'user', expect.stringContaining('Concepts:')]);
    });

    test('.clear clears memory', async () => {
        const handlers = createCommandHandlers({nar, send});
        const h = handlers.find(h => h.name === '.clear')!;
        expect(h).toBeDefined();
        await nar.believe('(A --> B)');
        expect(nar.getStatistics().totalConcepts).toBeGreaterThan(0);
        await h.handle('#ch', 'user', []);
        expect(sent).toContainEqual(['#ch', 'user', 'Memory cleared']);
        expect(nar.getStatistics().totalConcepts).toBe(0);
    });

    test('matches both dot and exclamation prefix', () => {
        const handlers = createCommandHandlers({nar, send});
        const h = handlers[0];
        expect(h).toBeDefined();
        expect(h!.matches('.help')).toBe(true);
        expect(h!.matches('!help')).toBe(true);
        expect(h!.matches('.stats')).toBe(false);
    });
});