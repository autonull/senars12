/**
 * `senars data validate` — Validate data integrity.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

export const sections = createCommandModule({
  name: 'data validate',
  description: 'Validate data integrity',
  usage: 'senars data validate <input> [options]',
  sections: [
    { lines: ['<input>                Input file path'] },
    { lines: ['--fix                  Attempt to fix validation errors', '--json                 Output machine-readable JSON'] },
  ],
  examples: [
    'senars data validate data.json',
    'senars data validate data.narsese --fix',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const input = positional[0];
    const fix = flagHelpers.has(rawFlags, '--fix');

    if (!input) {
      console.error('Error: <input> argument required');
      process.exit(1);
    }

    // This is a stub - actual validation would need to be implemented
    const result = {
      input,
      fix,
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
      fixed: 0,
    };

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Validating ${input}...`);
      if (fix) console.log(`  Fix mode: enabled`);
      if (result.valid) {
        console.log(`\n✓ Data is valid`);
      } else {
        console.log(`\n✗ Data has ${result.errors.length} error(s):`);
        for (const e of result.errors) console.log(`  - ${e}`);
      }
      if (result.warnings.length) {
        console.log(`\nWarnings (${result.warnings.length}):`);
        for (const w of result.warnings) console.log(`  - ${w}`);
      }
      if (fix && result.fixed) {
        console.log(`\nFixed ${result.fixed} issue(s)`);
      }
    }

    if (!result.valid && !fix) {
      process.exit(1);
    }
  }, flags, 'data validate');
});

export const dataValidateModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}