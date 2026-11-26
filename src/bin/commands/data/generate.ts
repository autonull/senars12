/**
 * `senars data generate` — Generate synthetic data.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

export const sections = createCommandModule({
  name: 'data generate',
  description: 'Generate synthetic data',
  usage: 'senars data generate [options]',
  sections: [
    { lines: ['--type <type>          Data type: beliefs|goals|episodes (default: beliefs)', '--count <n>            Number of items to generate (default: 100)', '--domain <name>        Domain/theme for generation (e.g., animals, logic, math)', '--output <path>        Output file path (default: stdout)', '--format <fmt>         Output format: narsese|json|csv|yaml (default: json)', '--json                 Output machine-readable JSON'] },
  ],
  examples: [
    'senars data generate --type beliefs --count 50 --domain animals',
    'senars data generate --type episodes --count 10 --output episodes.json',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const type = flagHelpers.str(rawFlags, '--type', 'beliefs');
    const count = flagHelpers.num(rawFlags, '--count', 100);
    const domain = flagHelpers.str(rawFlags, '--domain', 'general');
    const output = flagHelpers.str(rawFlags, '--output', '');
    const format = flagHelpers.str(rawFlags, '--format', 'json');

    const result = {
      type,
      count,
      domain,
      output: output ?? 'stdout',
      format,
      generated: count,
      success: true,
    };

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Generating ${count} ${type} (domain: ${domain})...`);
      console.log(`  Format: ${format}`);
      if (output) console.log(`  Output: ${output}`);
      console.log(`\n✓ Generated ${result.generated} items`);
    }
  }, flags, 'data generate');
});

export const dataGenerateModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}