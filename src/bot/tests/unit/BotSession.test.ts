import {BotSession} from '../../BotSession.js';
import {SeNARSFactory} from '../../../nar';
import {EmbeddedIRCServer} from '../../EmbeddedIRCServer.js';

describe('BotSession', () => {
let nar: ReturnType<typeof SeNARSFactory.createForBot>;
let _server: EmbeddedIRCServer;
let session: BotSession;

    beforeEach(async () => {
        nar = SeNARSFactory.createForBot({maxConcepts: 100});
        _server = new EmbeddedIRCServer({port: 0, hostname: '127.0.0.1', channel: '#test'});
        session = new BotSession({
            nar,
            ircConfig: {
                port: 0,
                hostname: '127.0.0.1',
                channel: '#test',
            },
        });
    });

    afterEach(async () => {
        await session.shutdown();
    });

    test('starts and stops without error', async () => {
        await session.start();
        expect(session.getNar()).toBeDefined();
        await session.shutdown();
    });

    test('NAR is accessible after creation', () => {
        expect(session.getNar()).toBe(nar);
    });

    test('accepts NAR with no IRC config', () => {
        const sessionNoIrc = new BotSession({nar});
        expect(sessionNoIrc.getNar()).toBe(nar);
    });
});