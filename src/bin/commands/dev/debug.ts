/**
 * `senars dev debug` — Debug running agent.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'dev:debug' });

export const sections: HelpSection[] = [
  standardSections.usage('senars dev debug', 'Debug running agent'),
  {
    title: 'Options',
    lines: [
      '--pid <n>              Process ID to debug',
      '--port <n>             Debug port (default: 9229)',
      '--attach               Attach to existing process',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars dev debug --pid 12345',
    'senars dev debug --port 9229 --attach',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const pid = argv.str('--pid');
  const port = parseInt(argv.str('--port', '9229'), 10);
  const attach = argv.has('--attach');

  const result = { pid, port, attach, success: true };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('Debug agent:');
    if (pid) console.log(`  PID: ${pid}`);
    console.log(`  Port: ${port}`);
    console.log(`  Attach: ${attach}`);
    console.log('\n[Debug not yet implemented]');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}