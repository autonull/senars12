/**
 * `senars serve http` — REST API Server (stub)
 *
 * TODO: Implement REST API server for SeNARS.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createStubCommand } from '../../lib/cli';
import type { CommandModule } from '../../lib/cli';

const sections: HelpSection[] = [
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

const main = createStubCommand('serve http', 'https://github.com/senars/senars/issues/XXX').main;

export const serveHttpModule: CommandModule = { main, sections };

// For direct execution (testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { runEntrypoint } = await import('../../lib/fatal-error');
  runEntrypoint(() => runCLI(main, { sections, version: '0.0.0' }));
}