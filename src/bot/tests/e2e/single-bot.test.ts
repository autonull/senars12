import {BotHarness} from '../support/BotHarness.js';
import {FakeIRCUser} from '../support/FakeIRCUser.js';

describe('Single Bot E2E', () => {
    let harness: BotHarness;

    beforeAll(async () => {
        harness = new BotHarness();
        await harness.spawn(['--profile=minimal']);
    }, 20000);

    afterAll(async () => {
        await harness?.kill();
    }, 10000);

    test('bot responds to greeting', async () => {
        const port = harness?.discoverPort() || 6670;
        const user = new FakeIRCUser('127.0.0.1', port);
        await user.connect();
        user.say('Hello bot');
        const reply = await user.waitForReply('bot', 5000);
        expect(reply).toBeTruthy();
        user.disconnect();
    }, 10000);

    test('bot ignores URL with nick', async () => {
        const port = harness?.discoverPort() || 6670;
        const user = new FakeIRCUser('127.0.0.1', port);
        await user.connect();
        user.say('http://example.com bot');
        const reply = await user.waitForReply('http', 2000);
        expect(reply).toBeNull();
        user.disconnect();
    }, 8000);
});
