/**
 * `senars imagine` — Run imagine pipeline (stub).
 */

import { runEntrypoint } from '../lib/fatal-error';
import { standardSections, type HelpSection } from '../lib/cli-utils';
import type { CommandModule } from '../lib/cli';
import { createStubModule } from '../lib/command-base';

export const sections: HelpSection[] = [
  standardSections.usage('senars imagine', 'Run imagine pipeline'),
  {
    title: 'Status',
    lines: ['⚠️  Command not yet implemented'],
  },
];

export const imagineModule: CommandModule = createStubModule('imagine', 'https://github.com/senars/senars/issues/XXX');

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../lib/cli-utils');
  runCLI(imagineModule.main, { sections: imagineModule.sections, version: '0.0.0' });
}