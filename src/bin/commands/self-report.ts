/**
 * `senars self-report` — Print cognitive state (stub).
 */

import { runEntrypoint } from '../lib/fatal-error';
import { standardSections, type HelpSection } from '../lib/cli-utils';
import type { CommandModule } from '../lib/cli';
import { createStubModule } from '../lib/command-base';

export const sections: HelpSection[] = [
  standardSections.usage('senars self-report', 'Print cognitive state'),
  {
    title: 'Status',
    lines: ['⚠️  Command not yet implemented'],
  },
];

export const selfReportModule: CommandModule = createStubModule('self-report', 'https://github.com/senars/senars/issues/XXX');

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../lib/cli-utils');
  runCLI(selfReportModule.main, { sections: selfReportModule.sections, version: '0.0.0' });
}