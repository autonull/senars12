/**
 * `senars config set` — Set configuration value.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { writeJsonFile } from '@senars/util/fs';
import { errMsg } from '@senars/util/error';
import { coerce } from '../args';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

export const sections = createCommandModule({
  name: 'config set',
  description: 'Set configuration value',
  usage: 'senars config set <key> <value>',
  sections: [
    { lines: ['<key>                  Dot-notation key path (e.g., lm.provider, profile.name)', '<value>                Value to set (auto-coerced: number, boolean, null, string)'] },
    { lines: ['--config <path>        Path to config file (default: senars.config.json)', '--json                 Output machine-readable JSON'] },
  ],
  examples: [
    'senars config set name my-agent',
    'senars config set lm.provider openai-compatible',
    'senars config set agent.name my-agent',
    'senars config set backends.nar.maxConcepts 200',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const configPath = flagHelpers.str(rawFlags, '--config', 'senars.config.json');
    const key = positional[0];
    const rawValue = positional[1];

    if (!key || rawValue === undefined) {
      console.error('Error: <key> and <value> arguments required');
      process.exit(1);
    }

    const value = coerce(rawValue);

    const { readFileSync } = await import('node:fs');
    const rawConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    const success = setNestedValue(rawConfig, key, value);

    if (!success) {
      const result = { error: `Cannot set key: ${key} (path does not exist in raw config)` };
      if (jsonOutput) console.log(JSON.stringify(result, null, 2));
      else console.error(result.error);
      process.exit(1);
    }

    writeJsonFile(configPath, rawConfig);

    if (jsonOutput) {
      console.log(JSON.stringify({ key, value, configPath, success: true }, null, 2));
    } else {
      console.log(`Set ${key} = ${JSON.stringify(value)}`);
      console.log(`Saved to ${configPath}`);
    }
  }, flags, 'config set');
});

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

export const configSetModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}