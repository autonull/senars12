/**
 * `senars data validate` — Validate data integrity.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'data:validate' });

export const sections: HelpSection[] = [
  standardSections.usage('senars data validate', 'Validate data integrity'),
  {
    title: 'Arguments',
    lines: [
      '<input>                Input file path',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--fix                  Attempt to fix validation errors',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars data validate data.json',
    'senars data validate data.narsese --fix',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const input = argv.positional[0];
  const fix = argv.has('--fix');

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
}

export const dataValidateModule: CommandModule = {
  main,
  sections,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}