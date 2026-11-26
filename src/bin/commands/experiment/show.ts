/**
 * `senars experiment show` — Show experiment details.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'experiment:show' });

export const sections: HelpSection[] = [
  standardSections.usage('senars experiment show', 'Show experiment details'),
  {
    title: 'Arguments',
    lines: [
      '<run-id>               Experiment run ID to show',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars experiment show abc123',
    'senars experiment show abc123 --json',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const runId = argv.positional[0];

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
}

export const experimentShowModule: CommandModule = {
  main,
  sections,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}