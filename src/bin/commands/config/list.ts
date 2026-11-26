/**
 * `senars config list` — List configuration (show effective config).
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { loadConfig } from '../../../config/index';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'config:list' });

export const sections: HelpSection[] = [
  standardSections.usage('senars config list', 'List effective configuration'),
  {
    title: 'Options',
    lines: [
      '--config <path>        Path to config file (default: senars.config.json)',
      '--json                 Output machine-readable JSON',
      '--section <name>       Show only specific section (profile, lm, routing, systemOne, backends)',
    ],
  },
  standardSections.examples([
    'senars config list',
    'senars config list --json',
    'senars config list --section lm',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const configPath = argv.str('--config', 'senars.config.json');
  const section = argv.str('--section');

  try {
    const config = await loadConfig(configPath);

    let output: Record<string, unknown> = {
      profile: config.profile,
      lm: config.lm,
      routing: config.routing,
      systemOne: config.systemOne,
      backends: config.backends,
      bot: config.bot,
      dialogue: config.dialogue,
    };

    if (section) {
      output = { [section]: output[section] };
    }

    if (jsonOutput) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log('=== Effective Configuration ===\n');
      printSection('Profile', output.profile);
      printSection('LM', output.lm);
      printSection('Routing', output.routing);
      printSection('System One', output.systemOne);
      printSection('Backends', output.backends);
    }
  } catch (e) {
    const { errMsg } = await import('@senars/util/error');
    const result = { error: errMsg(e) };
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else console.error('Error:', errMsg(e));
    process.exit(1);
  }
}

function printSection(title: string, data: unknown): void {
  console.log(`--- ${title} ---`);
  if (!data || (typeof data === 'object' && Object.keys(data as object).length === 0)) {
    console.log('  (not configured)');
  } else {
    console.log(JSON.stringify(data, null, 2).split('\n').map(l => `  ${l}`).join('\n'));
  }
  console.log('');
}

export const configListModule: CommandModule = {
  main,
  sections,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}