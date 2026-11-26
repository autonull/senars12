/**
 * `senars config validate` — Validate configuration file.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { loadConfig } from '../../../config/index';
import { createLogger, parseFlags, jsonMode, errMsg } from '@senars/util';

const logger = createLogger({ scope: 'config:validate' });

export const sections: HelpSection[] = [
  standardSections.usage('senars config validate', 'Validate configuration file'),
  {
    title: 'Options',
    lines: [
      '--config <path>        Path to config file (default: senars.config.json)',
      '--json                 Output machine-readable JSON',
      '--schema <version>     Schema version to validate against',
    ],
  },
  standardSections.examples([
    'senars config validate',
    'senars config validate --config ./custom.config.json',
    'senars config validate --json',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const configPath = argv.str('--config', 'senars.config.json');

  try {
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
  } catch (e) {
    const result = { valid: false, error: errMsg(e) };
    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error('✗ Configuration invalid:', errMsg(e));
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}