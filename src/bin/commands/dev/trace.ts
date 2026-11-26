/**
 * `senars dev trace` — Trace execution.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'dev:trace' });

export const sections: HelpSection[] = [
  standardSections.usage('senars dev trace', 'Trace execution'),
  {
    title: 'Options',
    lines: [
      '--filter <pattern>     Filter trace events by pattern',
      '--output <path>        Output file path (default: trace.json)',
      '--format <fmt>         Output format: json|chrome (default: json)',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars dev trace --filter "nar.*" --output trace.json',
    'senars dev trace --format chrome --output trace.chrome.json',
  ]),
]

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const filter = argv.str('--filter');
  const output = argv.str('--output', 'trace.json');
  const format = argv.str('--format', 'json');

  const result = { filter, output, format, success: true };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('Tracing execution:');
    if (filter) console.log(`  Filter: ${filter}`);
    console.log(`  Output: ${output}`);
    console.log(`  Format: ${format}`);
    console.log('\n[Tracing not yet implemented]');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}