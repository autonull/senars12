import {EmbeddedIRCServer} from '../../EmbeddedIRCServer.js';
import net from 'net';

const findAvailablePort = (): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 6670;
      server.close(() => resolve(port));
    });
    server.on('error', () => resolve(6670 + Math.floor(Math.random() * 1000)));
  });
};

describe('EmbeddedIRCServer', () => {
  let server: EmbeddedIRCServer;
  let port: number;

  beforeEach(async () => {
    port = await findAvailablePort();
    server = new EmbeddedIRCServer({port, channel: '#test'});
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
