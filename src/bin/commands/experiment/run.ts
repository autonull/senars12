/**
 * `senars experiment run` — Run an experiment.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'experiment:run' });

export const sections: HelpSection[] = [
  standardSections.usage('senars experiment run', 'Run an experiment'),
  {
    title: 'Options',
    lines: [
      '--config <path>        Path to experiment config file',
      '--name <name>          Experiment name',
      '--seed <n>             Random seed (default: random)',
      '--iterations <n>       Number of iterations (default: 1)',
      '--output <dir>         Output directory (default: .cache/experiments)',
      '--resume <run-id>      Resume from previous run',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars experiment run --config experiment.yaml',
    'senars experiment run --name "overload-test" --iterations 10',
    'senars experiment run --resume abc123',
  ]),
];

interface ExperimentResult {
  runId: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  iterations: number;
  seed: number;
  results?: Record<string, unknown>;
  error?: string;
}

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const configPath = argv.str('--config');
  const name = argv.str('--name', 'experiment');
  const seed = parseInt(argv.str('--seed', Math.floor(Math.random() * 1000000).toString()), 10);
  const iterations = parseInt(argv.str('--iterations', '1'), 10);
  const outputDir = argv.str('--output', '.cache/experiments');
  const resume = argv.str('--resume');

  const runId = resume ?? `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const result: ExperimentResult = {
    runId,
    name,
    status: 'running',
    startedAt: new Date().toISOString(),
    iterations,
    seed,
  };

  if (!jsonOutput) {
    console.log(`Starting experiment: ${name}`);
    console.log(`  Run ID: ${runId}`);
    console.log(`  Seed: ${seed}`);
    console.log(`  Iterations: ${iterations}`);
    if (configPath) console.log(`  Config: ${configPath}`);
    if (resume) console.log(`  Resuming from: ${resume}`);
  }

  try {
    // Simulate experiment run
    await new Promise((resolve) => setTimeout(resolve, 100));

    result.status = 'completed';
    result.completedAt = new Date().toISOString();
    result.results = {
      summary: `Experiment ${name} completed ${iterations} iteration(s)`,
      metrics: {
        successRate: 1.0,
        avgDuration: 50,
      },
    };

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`\n✓ Experiment completed: ${runId}`);
      console.log(`  Status: ${result.status}`);
      console.log(`  Duration: ${new Date(result.completedAt!).getTime() - new Date(result.startedAt).getTime()}ms`);
    }
  } catch (e) {
    result.status = 'failed';
    result.completedAt = new Date().toISOString();
    result.error = String(e);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(`\n✗ Experiment failed: ${result.error}`);
    }
    process.exit(1);
  }
}

export const experimentRunModule: CommandModule = {
  main,
  sections,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}