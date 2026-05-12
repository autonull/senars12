import {loadConfig, mergeConfig, PROFILES} from '../../config.js';

describe('Bot Config', () => {
    test('minimal profile has correct defaults', () => {
        expect(PROFILES.minimal.profile).toBe('minimal');
        expect(PROFILES.minimal.nick).toBe('SeNARchy');
        expect(PROFILES.minimal.loop?.budget).toBe(10);
    });

    test('standard profile has IRC enabled', () => {
        expect(PROFILES.standard.embodiments.irc?.enabled).toBe(true);
        expect(PROFILES.standard.embodiments.irc?.port).toBe(6667);
    });

test('loadConfig returns minimal for missing file', async () => {
  const config = await loadConfig('/nonexistent/config.json');
  expect(config.profile).toBe(PROFILES.minimal.profile);
  expect(config.nick).toBe(PROFILES.minimal.nick);
});

    test('mergeConfig combines configs', () => {
        const merged = mergeConfig(PROFILES.minimal, {nick: 'TestBot'});
        expect(merged.nick).toBe('TestBot');
        expect(merged.profile).toBe(PROFILES.minimal.profile);
    });
});
