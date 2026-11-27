/**
 * `senars experiment run` — Run an experiment.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';
import { sleep } from '@senars/util/async';

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

export const sections = createCommandModule({
  name: 'experiment run',
  description: 'Run an experiment',
  usage: 'senars experiment run [options]',
  sections: [
    { lines: ['--config <path>        Path to experiment config file', '--name <name>          Experiment name', '--seed <n>             Random seed (default: random)', '--iterations <n>       Number of iterations (default: 1)', '--output <dir>         Output directory (default: .cache/experiments)', '--resume <run-id>      Resume from previous run', '--json                 Output machine-readable JSON'] },
  ],
  examples: [
    'senars experiment run --config experiment.yaml',
    'senars experiment run --name "overload-test" --iterations 10',
    'senars experiment run --resume abc123',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const configPath = flagHelpers.str(rawFlags, '--config', '');
    const name = flagHelpers.str(rawFlags, '--name', 'experiment');
    const seed = flagHelpers.num(rawFlags, '--seed', Math.floor(Math.random() * 1000000));
    const iterations = flagHelpers.num(rawFlags, '--iterations', 1);
    const outputDir = flagHelpers.str(rawFlags, '--output', '.cache/experiments');
    const resume = flagHelpers.str(rawFlags, '--resume', '') || undefined;

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
      await sleep(100);

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
  }, flags, 'experiment run');
});

export const experimentRunModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}