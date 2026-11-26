/**
 * `senars demo benchmark` — Standardized performance benchmarks
 */

import { runEntrypoint } from '../../lib/fatal-error';
import { standardSections, type HelpSection } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createStubModule } from '../../lib/command-base';

export const sections: HelpSection[] = [
  standardSections.usage('senars demo benchmark', 'Standardized performance benchmarks'),
  {
    title: 'Options',
    lines: [
      '--suite <name>           Benchmark suite: derivation, memory, throughput, latency (default: all)',
      '--profile <name>         Profile to benchmark: logic | coprocessor | agent | device',
      '--iterations <n>         Number of iterations per test (default: 10)',
      '--output <path>          Output results to JSON file',
      '--compare <path>         Compare with baseline results',
      '-v, --version            Show version',
      '--verbose                Verbose output',
      '--quiet                  Suppress non-error output',
    ],
  },
  standardSections.examples([
    'senars demo benchmark',
    'senars demo benchmark --suite derivation --profile logic --iterations 20',
    'senars demo benchmark --suite memory --profile agent --output results.json',
    'senars demo benchmark --compare baseline.json',
  ]),
];

export const demoBenchmarkModule: CommandModule = createStubModule('demo benchmark', 'https://github.com/senars/senars/issues/XXX');

// Allow direct execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(demoBenchmarkModule.main, { sections: demoBenchmarkModule.sections, version: '0.0.0' });
}