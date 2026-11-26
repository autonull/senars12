/**
 * `senars dev benchmark` — Microbenchmarks.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';
import { createDiagnosticNAR, runDerivationBenchmarks } from '../../lib/diagnostics';

const logger = createLogger({ scope: 'dev:benchmark' });

export const sections: HelpSection[] = [
  standardSections.usage('senars dev benchmark', 'Run microbenchmarks'),
  {
    title: 'Options',
    lines: [
      '--suite <name>         Benchmark suite: inference|derivation|all (default: all)',
      '--iterations <n>       Number of iterations (default: 24)',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars dev benchmark --suite inference --iterations 50',
    'senars dev benchmark --suite derivation --json',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const suite = argv.str('--suite', 'all');
  const iterations = parseInt(argv.str('--iterations', '24'), 10);

  const result: { inference?: any; derivations?: any } = {};

  if (suite === 'all' || suite === 'inference') {
    const { nar, dispose } = await createDiagnosticNAR({ maxConcepts: 100 });
    const { stopwatch, perSecond } = await import('@senars/util/async');
    const elapsed = stopwatch();
    const derived = await nar.run(iterations);
    const ms = elapsed();
    result.inference = { cycles: iterations, ms, cycPerSec: perSecond(iterations, ms), derivations: derived };
    await dispose();
  }

  if (suite === 'all' || suite === 'derivation') {
    result.derivations = await runDerivationBenchmarks({ cycles: iterations });
  }

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.inference) {
      console.log(`Inference: ${result.inference.cycles} cycles in ${result.inference.ms}ms (${result.inference.cycPerSec.toFixed(0)} cyc/s), derivations=${result.inference.derivations}`);
    }
    if (result.derivations) {
      console.log('Derivation costs:');
      for (const d of result.derivations) {
        console.log(`  ${d.rule.padEnd(20)} ${d.conclusion}  calls=${d.calls} cpuMs=${d.cpuMs.toFixed(2)} durationMs=${d.durationMs.toFixed(2)}`);
      }
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}