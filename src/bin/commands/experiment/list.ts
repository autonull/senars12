/**
 * `senars experiment list` — List experiments.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

interface ExperimentRun {
  runId: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  iterations: number;
}

export const sections = createCommandModule({
  name: 'experiment list',
  description: 'List experiments',
  usage: 'senars experiment list [options]',
  sections: [
    { lines: ['--status <status>      Filter by status: running|completed|failed', '--json                 Output machine-readable JSON', '--limit <n>            Maximum experiments to show (default: 20)'] },
  ],
  examples: [
    'senars experiment list',
    'senars experiment list --status completed --json',
    'senars experiment list --limit 50',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const status = flagHelpers.str(rawFlags, '--status', '');
    const limit = flagHelpers.num(rawFlags, '--limit', 20);

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
  }, flags, 'experiment list');
});

export const experimentListModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}