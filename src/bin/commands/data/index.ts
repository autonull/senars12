/**
 * `senars data` — Data management commands (import, export, transform, generate, validate).
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { dataImportModule } from './import';
import { dataExportModule } from './export';
import { dataTransformModule } from './transform';
import { dataGenerateModule } from './generate';
import { dataValidateModule } from './validate';

// Register data subcommands
registerCommand('data import', dataImportModule);
registerCommand('data export', dataExportModule);
registerCommand('data transform', dataTransformModule);
registerCommand('data generate', dataGenerateModule);
registerCommand('data validate', dataValidateModule);

export const dataModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars data <import|export|transform|generate|validate>');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars data <import|export|transform|generate|validate> [options]'],
    },
    {
      title: 'Subcommands',
      lines: [
        '  import     Import data',
        '  export     Export data',
        '  transform  Transform data',
        '  generate   Generate synthetic data',
        '  validate   Validate data integrity',
      ],
    },
  ],
  subcommands: new Map([
    ['import', dataImportModule],
    ['export', dataExportModule],
    ['transform', dataTransformModule],
    ['generate', dataGenerateModule],
    ['validate', dataValidateModule],
  ]),
};