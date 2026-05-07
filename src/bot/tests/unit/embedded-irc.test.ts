import {EmbeddedIRCServer} from '../../EmbeddedIRCServer.js';

describe('EmbeddedIRCServer', () => {
    let server: EmbeddedIRCServer;

    beforeEach(() => {
        server = new EmbeddedIRCServer({port: 6670, channel: '#test'});
    });

    afterEach(async () => {
        await server.stop();
    });

    test('starts and stops', async () => {
        await server.start();
        expect(server).toBeDefined();
        await server.stop();
    });

    test('sends messages', async () => {
        await server.start();
        server.send('#test', 'Hello');
        await server.stop();
    });
});
