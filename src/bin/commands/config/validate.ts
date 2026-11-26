/**
 * `senars config validate` — Validate configuration file.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { loadConfig } from '../../../config/index';
import { errMsg } from '@senars/util/error';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

export const sections = createCommandModule({
  name: 'config validate',
  description: 'Validate configuration file',
  usage: 'senars config validate',
  sections: [
    { lines: ['--config <path>        Path to config file (default: senars.config.json)', '--json                 Output machine-readable JSON', '--schema <version>     Schema version to validate against'] },
  ],
  examples: [
    'senars config validate',
    'senars config validate --config ./custom.config.json',
    'senars config validate --json',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const configPath = flagHelpers.str(rawFlags, '--config', 'senars.config.json');

    const config = await loadConfig(configPath);
    const result = {
      valid: true,
      config: {
        profile: config.profile.name,
        lm: config.lm?.provider,
        backends: config.backends,
        systemOne: config.systemOne ? { enabled: config.systemOne.enabled } : undefined,
      },
    };

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('✓ Configuration is valid');
      console.log(`  Profile: ${config.profile.name}`);
      console.log(`  LM Provider: ${config.lm?.provider ?? 'not configured'}`);
      console.log(`  NAR Backend: ${config.backends?.nar?.enabled ? 'enabled' : 'disabled'}`);
      console.log(`  System One: ${config.systemOne?.enabled ? 'enabled' : 'disabled'}`);
    }
  }, flags, 'config validate');
});

export const configValidateModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}