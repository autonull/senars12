/**
 * `senars doctor bench` — Run micro-benchmarks.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createDiagnosticNAR, runDerivationBenchmarks } from '../../lib/diagnostics';
import { clamp, finiteOr } from '@senars/util/numeric';
import { stopwatch, perSecond } from '@senars/util/async';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

interface BenchResult {
  timestamp: string;
  inference?: { cycles: number; ms: number; cycPerSec: number; derivations: number };
  derivations?: Array<{ conclusion: string; rule: string; calls: number; cpuMs: number; durationMs: number }>;
}

export const sections = createCommandModule({
  name: 'doctor bench',
  description: 'Run micro-benchmarks',
  usage: 'senars doctor bench [options]',
  sections: [
    { lines: ['--json               Output machine-readable JSON', '--cycles <n>         Number of NAR cycles (default: 24, max: 200)', '--derivations        Run derivation cost benchmarks', '--inference          Run inference cycle benchmarks', '--output <path>      Write results to file', '--all                Run all benchmarks'] },
  ],
  examples: [
    'senars doctor bench',
    'senars doctor bench --cycles 50 --derivations',
    'senars doctor bench --all --json',
    'senars doctor bench --output bench-results.json',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const outputPath = flagHelpers.str(rawFlags, '--output', '');
    const cycles = clamp(finiteOr(flagHelpers.str(rawFlags, '--cycles', '24'), 24), 1, 200);
    const runDerivations = flagHelpers.has(rawFlags, '--derivations') || flagHelpers.has(rawFlags, '--all');
    const runInference = flagHelpers.has(rawFlags, '--inference') || flagHelpers.has(rawFlags, '--all') || !runDerivations;

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
  }, flags, 'doctor bench');
});

export const doctorBenchModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}