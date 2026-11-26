/**
 * `senars config get` — Get configuration value.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { loadConfig } from '../../../config/index';
import { createLogger, parseFlags, jsonMode, errMsg } from '@senars/util';

const logger = createLogger({ scope: 'config:get' });

export const sections: HelpSection[] = [
  standardSections.usage('senars config get', 'Get configuration value'),
  {
    title: 'Arguments',
    lines: [
      '<key>                  Dot-notation key path (e.g., lm.provider, profile.name)',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--config <path>        Path to config file (default: senars.config.json)',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars config get lm.provider',
    'senars config get profile.name',
    'senars config get systemOne.enabled --json',
  ]),
];

export async function main(flags: CommonFlags, positional: string[]): Promise<void> {
  const argv = parseFlags(); // For flags like --config, --json
  const jsonOutput = jsonMode(argv);
  const configPath = argv.str('--config', 'senars.config.json');
  const key = positional[0];

  if (!key) {
    console.error('Error: <key> argument required');
    process.exit(1);
  }

  try {
    const config = await loadConfig(configPath);
    const value = getNestedValue(config, key);

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
  } catch (e) {
    const result = { error: errMsg(e) };
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else console.error('Error:', errMsg(e));
    process.exit(1);
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part: string) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}