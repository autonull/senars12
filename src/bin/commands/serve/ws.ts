/**
 * `senars serve ws` — WebSocket Server (stub)
 *
 * TODO: Implement WebSocket server for SeNARS.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createStubCommand } from '../../lib/cli';

const sections: HelpSection[] = [
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

// Re-export as a stub for now - will be implemented in Session 2
export const main = createStubCommand('serve ws', 'https://github.com/senars/senars/issues/XXX').main;
export { sections };

// For direct execution (testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { runEntrypoint } = await import('../../lib/fatal-error');
  runEntrypoint(() => runCLI(main, { sections, version: '0.0.0' }));
}