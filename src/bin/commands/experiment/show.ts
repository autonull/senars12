/**
 * `senars experiment show` — Show experiment details.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

export const sections = createCommandModule({
  name: 'experiment show',
  description: 'Show experiment details',
  usage: 'senars experiment show <run-id> [options]',
  sections: [
    { lines: ['<run-id>               Experiment run ID to show'] },
    { lines: ['--json                 Output machine-readable JSON'] },
  ],
  examples: [
    'senars experiment show abc123',
    'senars experiment show abc123 --json',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const runId = positional[0];

    if (!runId) {
      console.error('Error: <run-id> argument required');
      process.exit(1);
    }

    // This is a stub - experiment persistence would need to be implemented
    const experiment = {
      runId,
      name: 'example-experiment',
      status: 'completed',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:01:00.000Z',
      iterations: 10,
      seed: 42,
      config: { name: 'example-experiment', iterations: 10 },
      results: {
        summary: 'Example experiment completed',
        metrics: { successRate: 1.0, avgDuration: 50 },
      },
    };

    if (jsonOutput) {
      console.log(JSON.stringify(experiment, null, 2));
    } else {
      console.log(`Experiment: ${experiment.name} (${experiment.runId})`);
      console.log(`  Status: ${experiment.status}`);
      console.log(`  Started: ${experiment.startedAt}`);
      console.log(`  Completed: ${experiment.completedAt}`);
      console.log(`  Iterations: ${experiment.iterations}`);
      console.log(`  Seed: ${experiment.seed}`);
      console.log(`  Config: ${JSON.stringify(experiment.config)}`);
      console.log(`  Results: ${JSON.stringify(experiment.results, null, 2).split('\n').map(l => `    ${l}`).join('\n')}`);
    }
  }, flags, 'experiment show');
});

export const experimentShowModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}