/**
 * `senars config set` — Set configuration value.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { loadConfig } from '../../../config/index';
import { writeJsonFile } from '@senars/util/fs';
import { createLogger, parseFlags, jsonMode, errMsg } from '@senars/util';
import { coerce } from '../args';

const logger = createLogger({ scope: 'config:set' });

export const sections: HelpSection[] = [
  standardSections.usage('senars config set', 'Set configuration value'),
  {
    title: 'Arguments',
    lines: [
      '<key>                  Dot-notation key path (e.g., lm.provider, profile.name)',
      '<value>                Value to set (auto-coerced: number, boolean, null, string)',
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
    'senars config set name my-agent',
    'senars config set lm.provider openai-compatible',
    'senars config set agent.name my-agent',
    'senars config set backends.nar.maxConcepts 200',
  ]),
];

export async function main(flags: CommonFlags, positional: string[]): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const configPath = argv.str('--config', 'senars.config.json');
  const key = positional[0];
  const rawValue = positional[1];

  if (!key || rawValue === undefined) {
    console.error('Error: <key> and <value> arguments required');
    process.exit(1);
  }

  const value = coerce(rawValue);

  try {
    const { readFileSync, writeFileSync } = await import('node:fs');
    const rawConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    const success = setNestedValue(rawConfig, key, value);

    if (!success) {
      const result = { error: `Cannot set key: ${key} (path does not exist in raw config)` };
      if (jsonOutput) console.log(JSON.stringify(result, null, 2));
      else console.error(result.error);
      process.exit(1);
    }

    writeFileSync(configPath, JSON.stringify(rawConfig, null, 2));

    if (jsonOutput) {
      console.log(JSON.stringify({ key, value, configPath, success: true }, null, 2));
    } else {
      console.log(`Set ${key} = ${JSON.stringify(value)}`);
      console.log(`Saved to ${configPath}`);
    }
  } catch (e) {
    const result = { error: errMsg(e) };
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else console.error('Error:', errMsg(e));
    process.exit(1);
  }
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): boolean {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      return false;
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  if (!(lastPart in current)) {
    return false;
  }

  current[lastPart] = value;
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}