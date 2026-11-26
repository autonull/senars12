/**
 * `senars config list` — List configuration (show effective config).
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { loadConfig } from '../../../config/index';
import { errMsg } from '@senars/util/error';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

export const sections = createCommandModule({
  name: 'config list',
  description: 'List effective configuration',
  usage: 'senars config list',
  sections: [
    { lines: ['--config <path>        Path to config file (default: senars.config.json)', '--json                 Output machine-readable JSON', '--section <name>       Show only specific section (profile, lm, routing, systemOne, backends)'] },
  ],
  examples: [
    'senars config list',
    'senars config list --json',
    'senars config list --section lm',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const configPath = flagHelpers.str(rawFlags, '--config', 'senars.config.json');
    const section = flagHelpers.str(rawFlags, '--section', '');

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
  }, flags, 'config list');
});

function printSection(title: string, data: unknown): void {
  console.log(`--- ${title} ---`);
  if (!data || (typeof data === 'object' && Object.keys(data as object).length === 0)) {
    console.log('  (not configured)');
  } else {
    console.log(JSON.stringify(data, null, 2).split('\n').map(l => `  ${l}`).join('\n'));
  }
  console.log('');
}

export const configListModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}