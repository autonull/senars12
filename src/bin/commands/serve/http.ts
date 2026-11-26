/**
 * `senars serve http` — REST API Server (stub)
 *
 * TODO: Implement REST API server for SeNARS.
 */

import { runEntrypoint } from '../../lib/fatal-error';
import { standardSections, type HelpSection } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createStubModule } from '../../lib/command-base';

export const sections: HelpSection[] = [
  standardSections.usage('senars serve http', 'Start REST API server'),
  {
    title: 'Options',
    lines: [
      '--port <number>       HTTP port (default: 8767)',
      '--host <address>      Bind address (default: 0.0.0.0)',
      '--cors                Enable CORS',
      '-p, --profile <kind>  Profile: logic | coprocessor | agent | device',
      '--web-ui              Enable Web UI',
    ],
  },
  standardSections.examples([
    'senars serve http --port 8767',
    'senars serve http --port 3000 --cors --profile agent',
  ]),
];

export const serveHttpModule: CommandModule = createStubModule('serve http', 'https://github.com/senars/senars/issues/XXX');

// For direct execution (testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(serveHttpModule.main, { sections: serveHttpModule.sections, version: '0.0.0' });
}