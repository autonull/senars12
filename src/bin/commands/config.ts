/** Application config read/write commands (`.config-*`). Mutates `rt.appConfig` in place. */

import { envStrOr, thaw, writeJsonFile } from '@senars/util';
import { cmd } from '../../cli/commands.js';
import { coerce, flagsOf, setPath, tokenize } from './args.js';
import type { BotRuntime } from './context.js';

const DEFAULT_CONFIG_PATH = 'senars.config.json';

const configPath = (args = ''): string =>
  args.trim() || envStrOr(DEFAULT_CONFIG_PATH, 'SENARS_CONFIG');

/**
 * Reload the app config from disk and install it on the runtime. `.config-reload` and
 * `.s1-config reload` are the same operation under two names, and each had its own
 * copy of it — the dynamic import and the message included.
 */
export const reloadAppConfig = async (rt: BotRuntime): Promise<string> => {
  const { loadConfig } = await import('../../config/index.js');
  rt.appConfig = await loadConfig();
  return 'Config reloaded (LM/routing changes need restart)';
};

export const configCommandsFor = (rt: BotRuntime) => [
  cmd('config-show', 'Show effective config', () =>
    JSON.stringify(
      {
        profile: rt.appConfig.profile,
        lm: rt.appConfig.lm,
        routing: rt.appConfig.routing,
        systemOne: rt.appConfig.systemOne ? { enabled: rt.appConfig.systemOne.enabled } : undefined,
      },
      null,
      2
    )
  ),
  cmd('config-set', 'Set config value (dot notation)', (args = '') => {
    const [path, ...rest] = tokenize(args);
    if (!path || !rest.length) return 'Usage: .config-set <dot.path> <value>';
    const value = coerce(rest.join(' '));
    return setPath(rt.appConfig as unknown as Record<string, unknown>, path, value)
      ? `Set ${path} (persist with .config-save)`
      : `Unknown path: ${path}`;
  }),
  cmd('config-save', 'Save config to file', async (args = '') => {
    const path = configPath(args);
    await writeJsonFile(path, rt.appConfig);
    return `Saved to ${path}`;
  }),
  cmd('config-reload', 'Reload config from file', () => reloadAppConfig(rt)),
  cmd('config-reset', 'Reset config to defaults (requires --yes)', async (args = '') => {
    if (!flagsOf(args).has('--yes')) {
      return 'Destructive. Re-run as .config-reset --yes to confirm';
    }
    const { DEFAULT_APP_CONFIG } = await import('../../config/index.js');
    rt.appConfig = thaw(DEFAULT_APP_CONFIG);
    return 'Config reset to defaults (persist with .config-save; restart bot to apply)';
  }),
];
