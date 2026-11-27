/**
 * `senars config get` — Get configuration value.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { loadConfig } from '../../../config/index';
import { errMsg } from '@senars/util/error';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';
import { getNested } from '@senars/util/object';

export const sections = createCommandModule({
  name: 'config get',
  description: 'Get configuration value',
  usage: 'senars config get <key>',
  sections: [
    { lines: ['<key>                  Dot-notation key path (e.g., lm.provider, profile.name)'] },
    { lines: ['--config <path>        Path to config file (default: senars.config.json)', '--json                 Output machine-readable JSON'] },
  ],
  examples: [
    'senars config get lm.provider',
    'senars config get profile.name',
    'senars config get systemOne.enabled --json',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const configPath = flagHelpers.str(rawFlags, '--config', 'senars.config.json');
    const key = positional[0];

    if (!key) {
      console.error('Error: <key> argument required');
      process.exit(1);
    }

    const config = await loadConfig(configPath);
    const value = getNested(config, key);

    if (value === undefined) {
      const result = { error: `Key not found: ${key}` };
      if (jsonOutput) console.log(JSON.stringify(result, null, 2));
      else console.error(result.error);
      process.exit(1);
    }

    if (jsonOutput) {
      console.log(JSON.stringify({ key, value }, null, 2));
    } else {
      console.log(JSON.stringify(value));
    }
  }, flags, 'config get');
});

export const configGetModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}