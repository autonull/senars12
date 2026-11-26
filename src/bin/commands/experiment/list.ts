/**
 * `senars experiment list` — List experiments.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'experiment:list' });

export const sections: HelpSection[] = [
  standardSections.usage('senars experiment list', 'List experiments'),
  {
    title: 'Options',
    lines: [
      '--status <status>      Filter by status: running|completed|failed',
      '--json                 Output machine-readable JSON',
      '--limit <n>            Maximum experiments to show (default: 20)',
    ],
  },
  standardSections.examples([
    'senars experiment list',
    'senars experiment list --status completed --json',
    'senars experiment list --limit 50',
  ]),
];

interface ExperimentRun {
  runId: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  iterations: number;
}

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const status = argv.str('--status');
  const limit = parseInt(argv.str('--limit', '20'), 10);

  // This is a stub - experiment persistence would need to be implemented
  const experiments: ExperimentRun[] = [];

  const filtered = status ? experiments.filter((e) => e.status === status) : experiments;
  const output = { experiments: filtered.slice(0, limit), total: filtered.length };

  if (jsonOutput) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    if (output.experiments.length === 0) {
      console.log('No experiments found');
      return;
    }
    console.log('Run ID                                    Name               Status      Started              Iterations');
    console.log('-----------------------------------------------------------------------------------------------');
    for (const e of output.experiments) {
      console.log(
        `${e.runId.padEnd(40)} ${e.name.padEnd(18)} ${e.status.padEnd(10)} ${e.startedAt.padEnd(19)} ${e.iterations}`
      );
    }
  }
}

export const experimentListModule: CommandModule = {
  main,
  sections,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}