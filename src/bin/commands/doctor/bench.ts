/**
 * `senars doctor bench` — Run micro-benchmarks.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode, clamp, finiteOr, stopwatch, perSecond } from '@senars/util';
import { createDiagnosticNAR, runDerivationBenchmarks } from '../../lib/diagnostics';

const logger = createLogger({ scope: 'doctor:bench' });

export const sections: HelpSection[] = [
  standardSections.usage('senars doctor bench', 'Run micro-benchmarks'),
  {
    title: 'Options',
    lines: [
      '--json               Output machine-readable JSON',
      '--cycles <n>         Number of NAR cycles (default: 24, max: 200)',
      '--derivations        Run derivation cost benchmarks',
      '--inference          Run inference cycle benchmarks',
      '--output <path>      Write results to file',
      '--all                Run all benchmarks',
    ],
  },
  standardSections.examples([
    'senars doctor bench',
    'senars doctor bench --cycles 50 --derivations',
    'senars doctor bench --all --json',
    'senars doctor bench --output bench-results.json',
  ]),
];

interface BenchResult {
  timestamp: string;
  inference?: { cycles: number; ms: number; cycPerSec: number; derivations: number };
  derivations?: Array<{ conclusion: string; rule: string; calls: number; cpuMs: number; durationMs: number }>;
}

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const outputPath = argv.str('--output');
  const cycles = clamp(finiteOr(argv.str('--cycles', '24'), 24), 1, 200);
  const runDerivations = argv.has('--derivations') || argv.has('--all');
  const runInference = argv.has('--inference') || argv.has('--all') || !runDerivations;

  const result: BenchResult = { timestamp: new Date().toISOString() };

  if (!jsonOutput) console.log('=== SeNARS Benchmarks ===\n');

  // Inference benchmark
  if (runInference) {
    if (!jsonOutput) console.log(`Running ${cycles} NAR inference cycles...`);
    const { nar, dispose } = await createDiagnosticNAR({ maxConcepts: 100 });
    const elapsed = stopwatch();
    const derived = await nar.run(cycles);
    const ms = elapsed();
    const cycPerSec = perSecond(cycles, ms);

    result.inference = { cycles, ms, cycPerSec, derivations: derived };

    if (!jsonOutput) {
      console.log(`  ${cycles} cycles in ${ms}ms (${cycPerSec.toFixed(0)} cyc/s), derivations=${derived}`);
    }
    await dispose();
  }

  // Derivation benchmarks
  if (runDerivations) {
    if (!jsonOutput) console.log('\nRunning derivation cost benchmarks...');
    const derivations = await runDerivationBenchmarks();
    result.derivations = derivations;

    if (!jsonOutput) {
      console.log('  Top costly derivations:');
      if (!derivations.length) {
        console.log('    (no rule fires produced by the benchmark workload)');
      } else {
        for (const d of derivations) {
          console.log(`    ${d.rule.padEnd(20)} ${d.conclusion}  calls=${d.calls} cpuMs=${d.cpuMs.toFixed(2)} durationMs=${d.durationMs.toFixed(2)}`);
        }
      }
    }
  }

  if (!jsonOutput && !runDerivations) {
    console.log('\nFull suites: pnpm bench');
  }

  if (jsonOutput) {
    const json = JSON.stringify(result, null, 2);
    if (outputPath) {
      const { writeFileSync } = await import('node:fs');
      writeFileSync(outputPath, json);
    } else {
      console.log(json);
    }
  }
}

// Allow direct execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}