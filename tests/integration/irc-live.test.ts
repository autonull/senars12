import {describe, it, expect, beforeAll, afterAll} from '@jest/globals';
import {createServer, type Server, type Socket} from 'node:net';
import {mkdtempSync, rmSync} from 'fs';
import {tmpdir} from 'os';
import {join} from 'path';
import {createAgent} from '../../src/agent/agent.js';
import {SeNARSFactory} from '../../src/nar/index.js';
import {bindAgentToConnection} from '../../src/agent/io-bridge.js';
import {IRCConnection} from '../../src/io/connections/irc.js';
import {CommandRegistry} from '../../src/io/commands/registry.js';
import {InMemorySessionManager} from '../../src/agent/SessionManager.js';
import {EpisodicMemory} from '../../src/nar/memory/EpisodicMemory.js';
import type {LMClient} from '../../src/nar/lm/types.js';
import type {NAR} from '../../src/nar/nar.js';

class MockIRCServer {
    private server: Server;
    private sockets: Socket[] = [];
    public port = 0;
    public onClientMessage: ((from: string, to: string, text: string) => void) | null = null;
    private nicks: Map<Socket, string> = new Map();

    constructor() {
        this.server = createServer(socket => {
            this.sockets.push(socket);
            let nick = '';
            let buffer = '';
            socket.on('data', chunk => {
                buffer += chunk.toString();
                const lines = buffer.split('\r\n');
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                    if (line.startsWith('NICK ')) {
                        nick = line.slice(5).trim();
                        this.nicks.set(socket, nick);
                    } else if (line.startsWith('USER ')) {
                        if (nick) {
                            socket.write(`:mock 001 ${nick} :Welcome\r\n`);
                        }
                    } else if (line.startsWith('JOIN ')) {
                        const channel = line.slice(5).trim().split(' ')[0] ?? '';
                        socket.write(`:${nick}!u@host JOIN ${channel}\r\n`);
                        socket.write(`:mock 353 ${nick} = ${channel} :${nick}\r\n`);
                        socket.write(`:mock 366 ${nick} ${channel} :End of /NAMES list\r\n`);
                    } else if (line.startsWith('PRIVMSG ')) {
                        const m = line.match(/^PRIVMSG (\S+) :(.*)$/);
                        if (m && nick) {
                            this.onClientMessage?.(nick, m[1] ?? '', m[2] ?? '');
                        }
                    } else if (line.startsWith('PING ')) {
                        socket.write(`PONG ${line.slice(5)}\r\n`);
                    }
                }
            });
        });
    }

    listen(): Promise<void> {
        return new Promise(resolve => {
            this.server.listen(0, '127.0.0.1', () => {
                const addr = this.server.address();
                if (addr && typeof addr === 'object') this.port = addr.port;
                resolve();
            });
        });
    }

    send(sender: Socket, from: string, target: string, text: string): void {
        const line = `:${from}!u@host PRIVMSG ${target} :${text}\r\n`;
        sender.write(line);
    }

    close(): Promise<void> {
        return new Promise(resolve => {
            for (const sock of this.sockets) sock.end();
            this.server.close(() => resolve());
        });
    }
}

const scriptedLM: LMClient = {
    provider: 'scripted',
    model: 'test',
    available: true,
    async generateText(p: string) {
        if (p.includes('hello')) return 'Hi there!';
        return 'Mock reply';
    },
};

describe('IRC live integration', () => {
    let mockServer: MockIRCServer;
    let tempDir: string;
    let conn: IRCConnection;
    let nar: NAR;

    beforeAll(async () => {
        tempDir = mkdtempSync(join(tmpdir(), 'irc-live-'));
        mockServer = new MockIRCServer();
        await mockServer.listen();
    });

    afterAll(async () => {
        if (conn) await conn.disconnect('test done').catch(() => undefined);
        if (mockServer) await mockServer.close();
        rmSync(tempDir, {recursive: true, force: true});
    });

    it('connects bot to mock IRC and exchanges messages', async () => {
        const episodicMemory = new EpisodicMemory({enabled: true, basePath: tempDir, retentionDays: 1, maxEntriesPerFile: 100});
        nar = SeNARSFactory.createForTesting({maxConcepts: 20});
        const agent = createAgent({nar, lmClient: scriptedLM, episodicMemory});
        const sessionManager = new InMemorySessionManager();
        const commandRegistry = new CommandRegistry();
        commandRegistry.register({name: 'ping', description: '', usage: '', execute: async () => 'pong'});

        const noopLogger = {
            debug: () => undefined,
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
            child: () => noopLogger,
        };

        const receivedBotMessages: Array<{text: string}> = [];
        mockServer.onClientMessage = (from, _to, text) => {
            if (from === 'senars-bot') receivedBotMessages.push({text});
        };

        conn = new IRCConnection(
            {id: 'irc-test', enabled: true, type: 'irc', config: {server: '127.0.0.1', port: mockServer.port, nick: 'senars-bot', channels: ['#test'], tls: false, floodProtectionDelay: 100}},
            {nar, emit: () => undefined, logger: noopLogger},
        );
        await conn.connect();
        bindAgentToConnection(agent, conn, {
            sessionManager,
            commandRegistry,
            enableNlTranslation: false,
            enableNarseseHumanization: false,
        });

        // Wait for bot to join (faster with small flood protection delay)
        await new Promise(r => setTimeout(r, 6000));

        // Send a PRIVMSG to the bot from a fictional alice user
        const botSock = (mockServer as unknown as {sockets: Socket[]}).sockets[0];
        if (botSock) {
            mockServer.send(botSock, 'alice', '#test', 'hello there');
        }

        // Wait for the bot to respond (cold + LM call)
        await new Promise(r => setTimeout(r, 6000));

        expect(receivedBotMessages.length).toBeGreaterThan(0);
    }, 30000);
});
