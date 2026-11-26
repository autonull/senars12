/**
 * `senars completion` — Generate shell completions (stub).
 */

import { runEntrypoint } from '../lib/fatal-error';
import { standardSections, type HelpSection } from '../lib/cli-utils';
import type { CommandModule } from '../lib/cli';
import { createStubModule } from '../lib/command-base';

export const sections: HelpSection[] = [
  standardSections.usage('senars completion', 'Generate shell completions'),
  {
    title: 'Status',
    lines: ['⚠️  Command not yet implemented'],
  },
];

export const completionModule: CommandModule = createStubModule('completion', 'https://github.com/senars/senars/issues/XXX');

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../lib/cli-utils');
  runCLI(completionModule.main, { sections: completionModule.sections, version: '0.0.0' });
}