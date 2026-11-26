/**
 * `senars serve ws` — WebSocket Server (stub)
 *
 * TODO: Implement WebSocket server for SeNARS.
 */

import { runEntrypoint } from '../../lib/fatal-error';
import { standardSections, type HelpSection } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createStubModule } from '../../lib/command-base';

export const sections: HelpSection[] = [
  standardSections.usage('senars serve ws', 'Start WebSocket server'),
  {
    title: 'Options',
    lines: [
      '--port <number>       WebSocket port (default: 8768)',
      '--host <address>      Bind address (default: 0.0.0.0)',
      '--path <path>         WebSocket path (default: /ws)',
      '-p, --profile <kind>  Profile: logic | coprocessor | agent | device',
      '--web-ui              Enable Web UI',
    ],
  },
  standardSections.examples([
    'senars serve ws --port 8768',
    'senars serve ws --port 3000 --path /senars --profile agent',
  ]),
];

export const serveWsModule: CommandModule = createStubModule('serve ws', 'https://github.com/senars/senars/issues/XXX');

// For direct execution (testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(serveWsModule.main, { sections: serveWsModule.sections, version: '0.0.0' });
}