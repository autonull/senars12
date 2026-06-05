import {resolveReplyTarget} from '../../../src/io/connections/reply-target.js';
import type {Connection, IOMessage} from '../../../src/io/types.js';

class FakeConn implements Partial<Connection> {
    constructor(public readonly id: string, public readonly type: string) {}
    state = 'connected' as const;
    name = 'fake';
    async connect() {}
    async disconnect() {}
    async reconnect() {}
    async send() {}
    onMessage() {}
    onStateChange() {}
    onError() {}
    getStatus() { return {state: this.state, messageCount: 0, errorCount: 0}; }
    async reconfigure() {}
}

const msg = (overrides: Partial<IOMessage>): IOMessage => ({
    id: 'm1', source: 'irc', origin: 'irc:direct:alice', sender: 'alice', text: 'hi', timestamp: 1, ...overrides,
});

describe('resolveReplyTarget', () => {
    it('returns sender for non-IRC connections', () => {
        const cli = new FakeConn('cli', 'cli') as Connection;
        const m = msg({sender: 'alice'});
        expect(resolveReplyTarget(cli, m)).toBe('alice');
    });

    it('returns channel for IRC channel messages', () => {
        const irc = new FakeConn('irc', 'irc') as Connection;
        const m = msg({origin: 'irc:#senars:alice', sender: 'alice'});
        expect(resolveReplyTarget(irc, m)).toBe('#senars');
    });

    it('returns sender for IRC direct messages', () => {
        const irc = new FakeConn('irc', 'irc') as Connection;
        const m = msg({origin: 'irc:direct:alice', sender: 'alice'});
        expect(resolveReplyTarget(irc, m)).toBe('alice');
    });

    it('handles IRC origins with extra path segments', () => {
        const irc = new FakeConn('irc', 'irc') as Connection;
        const m = msg({origin: 'irc:#deep:channel:alice', sender: 'alice'});
        expect(resolveReplyTarget(irc, m)).toBe('#deep');
    });

    it('returns sender for IRC with empty channel segment', () => {
        const irc = new FakeConn('irc', 'irc') as Connection;
        const m = msg({origin: 'irc::alice', sender: 'alice'});
        expect(resolveReplyTarget(irc, m)).toBe('alice');
    });
});
