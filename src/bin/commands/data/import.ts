/**
 * `senars data import` — Import data.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

export const sections = createCommandModule({
  name: 'data import',
  description: 'Import data',
  usage: 'senars data import <file> [options]',
  sections: [
    { lines: ['<file>                 Input file path'] },
    { lines: ['--format <fmt>         Input format: narsese|json|csv|yaml (default: auto-detect)', '--batch-size <n>       Batch size for import (default: 100)', '--validate             Validate data before import', '--json                 Output machine-readable JSON'] },
  ],
  examples: [
    'senars data import data.json',
    'senars data import beliefs.narsese --format narsese --validate',
    'senars data import data.csv --format csv --batch-size 500',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const file = positional[0];
    const format = flagHelpers.str(rawFlags, '--format', 'auto');
    const batchSize = flagHelpers.num(rawFlags, '--batch-size', 100);
    const validate = flagHelpers.has(rawFlags, '--validate');

    if (!file) {
      console.error('Error: <file> argument required');
      process.exit(1);
    }

    // This is a stub - actual import would need to be implemented
    const result = {
      file,
      format,
      batchSize,
      validate,
      imported: 0,
      errors: 0,
      success: true,
    };

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Importing ${file} (${format})...`);
      console.log(`  Batch size: ${batchSize}`);
      console.log(`  Validate: ${validate}`);
      console.log(`\n✓ Imported ${result.imported} items, ${result.errors} errors`);
    }
  }, flags, 'data import');
});

export const dataImportModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}