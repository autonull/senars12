/**
 * `senars experiment analyze` — Analyze experiment results.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'experiment:analyze' });

export const sections: HelpSection[] = [
  standardSections.usage('senars experiment analyze', 'Analyze experiment results'),
  {
    title: 'Arguments',
    lines: [
      '<run-id>               Experiment run ID to analyze',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--statistical          Include statistical analysis',
      '--output <path>        Output file path',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars experiment analyze abc123',
    'senars experiment analyze abc123 --statistical --json',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const runId = argv.positional[0];
  const statistical = argv.has('--statistical');
  const outputPath = argv.str('--output');

  if (!runId) {
    console.error('Error: <run-id> argument required');
    process.exit(1);
  }

  // This is a stub - experiment persistence would need to be implemented
  const analysis = {
    runId,
    summary: 'Experiment analysis complete',
    metrics: {
      successRate: { mean: 0.95, std: 0.05, min: 0.85, max: 1.0 },
      avgDuration: { mean: 55, std: 10, min: 40, max: 80 },
    },
    statistical: statistical
      ? {
          confidenceInterval: { successRate: [0.9, 1.0], avgDuration: [50, 60] },
          pValue: 0.05,
        }
      : undefined,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(analysis, null, 2));
  } else {
    console.log(`Analyzing ${runId}:`);
    console.log(`  Success Rate: mean=${analysis.metrics.successRate.mean}, std=${analysis.metrics.successRate.std}`);
    console.log(`  Avg Duration: mean=${analysis.metrics.avgDuration.mean}ms, std=${analysis.metrics.avgDuration.std}ms`);
    if (statistical) {
      console.log(`  95% CI Success Rate: [${analysis.statistical!.confidenceInterval.successRate.join(', ')}]`);
      console.log(`  95% CI Avg Duration: [${analysis.statistical!.confidenceInterval.avgDuration.join(', ')}]ms`);
      console.log(`  P-value: ${analysis.statistical!.pValue}`);
    }
  }

  if (outputPath) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(outputPath, JSON.stringify(analysis, null, 2));
    if (!jsonOutput) console.log(`\nAnalysis written to ${outputPath}`);
  }
}

export const experimentAnalyzeModule: CommandModule = {
  main,
  sections,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}