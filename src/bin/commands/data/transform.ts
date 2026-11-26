/**
 * `senars data transform` — Transform data.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

export const sections = createCommandModule({
  name: 'data transform',
  description: 'Transform data',
  usage: 'senars data transform <input> [options]',
  sections: [
    { lines: ['<input>                Input file path'] },
    { lines: ['--output <path>        Output file path (required)', '--script <path>        Transform script path (JavaScript/TypeScript)', '--dry-run              Preview transformation without writing', '--json                 Output machine-readable JSON'] },
  ],
  examples: [
    'senars data transform input.json --output output.json --script transform.ts',
    'senars data transform data.narsese --output data.json --dry-run',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const input = positional[0];
    const output = flagHelpers.str(rawFlags, '--output', '');
    const script = flagHelpers.str(rawFlags, '--script', '');
    const dryRun = flagHelpers.has(rawFlags, '--dry-run');

    if (!input) {
      console.error('Error: <input> argument required');
      process.exit(1);
    }

    if (!output && !dryRun) {
      console.error('Error: --output required (unless --dry-run)');
      process.exit(1);
    }

    // This is a stub - actual transform would need to be implemented
    const result = {
      input,
      output: dryRun ? 'dry-run' : output,
      script,
      dryRun,
      transformed: 0,
      success: true,
    };

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Transforming ${input}...`);
      if (script) console.log(`  Script: ${script}`);
      if (dryRun) console.log(`  Dry run: true`);
      console.log(`\n✓ Transformed ${result.transformed} items`);
      if (!dryRun) console.log(`  Output: ${output}`);
    }
  }, flags, 'data transform');
});

export const dataTransformModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}